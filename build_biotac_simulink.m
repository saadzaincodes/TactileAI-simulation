%% BUILD SIMPLIFIED BIOTAC SIMULINK MODEL (Programmatic)
%  Creates a 3-block deployment model:
%    1. Sensor Input        — replays normalised BioTac data
%    2. Ensemble Classifier — 3 per-finger NNs, averaged
%    3. Slip Controller     — Threshold, 50ms hold, and Force output
%
%  Plus: feedback loop via a simple sensor-response plant model,
%        a mechanical delay to prevent algebraic loops, scopes for 
%        monitoring.

clc; clear; close all;

% Suppress shadowing warning from previous runs saving the .slx file
warning('off', 'Simulink:Engine:ShadowedModelName');
warning('off', 'Simulink:Engine:SaveWithShadowedModel');

%% ============================================================
%  CONFIGURATION
%  ============================================================
MODEL_NAME       = 'BioTac_SlipDetection_Simplified';
SAMPLE_TIME      = 0.001;      % 1 ms sample period
SIM_DURATION     = inf;        % Set to 'inf' to run continuously

%% ============================================================
%  LOAD TRAINED MODELS + DATA
%  ============================================================
fprintf('Loading trained models and data...\n');

load('biotac_data.mat', 'X_test', 'Y_test', 'num_electrodes', 'num_fingers');
load('biotac_simulation_results_v2.mat', ...
    'finger_nets', 'finger_mu', 'finger_sigma');

num_samples  = size(X_test, 1);
num_features = num_electrodes * num_fingers;  % 72

X_test_normed = zeros(size(X_test));
finger_cols = {1:24, 25:48, 49:72};
for f = 1:3
    cols = finger_cols{f};
    X_test_normed(:, cols) = (X_test(:, cols) - finger_mu{f}) ./ finger_sigma{f};
end

%% ============================================================
%  PREPARE WORKSPACE VARIABLES FOR SIMULINK
%  ============================================================

% --- SCENARIO SELECTOR ---
% Change this word to test different behaviors: 
% 'stable' = Test a firm hold (only Y_test == 0 data)
% 'slip'   = Test a falling object (only Y_test == 1 data)
% 'all'    = Test the original mixed chronological sequence

SCENARIO = 'slip'; 

fprintf('  Applying filter: Isolating "%s" data...\n', SCENARIO);

if strcmp(SCENARIO, 'stable')
    target_idx = find(Y_test == 0);
elseif strcmp(SCENARIO, 'slip')
    target_idx = find(Y_test == 1);
else
    target_idx = 1:num_samples; % Default: use everything
end

% Extract only the requested rows
X_filtered = double(X_test_normed(target_idx, :));
Y_filtered = double(Y_test(target_idx));

sensor_input_struct.time = [];
sensor_input_struct.signals.values = double(X_test_normed);
sensor_input_struct.signals.dimensions = num_features;

ground_truth_struct.time = [];
ground_truth_struct.signals.values = double(Y_test);
ground_truth_struct.signals.dimensions = 1;

finger_net_1 = finger_nets{1};
finger_net_2 = finger_nets{2};
finger_net_3 = finger_nets{3};

save('biotac_simulink_params.mat', ...
    'sensor_input_struct', 'ground_truth_struct', ...
    'finger_net_1', 'finger_net_2', 'finger_net_3', ...
    'SAMPLE_TIME', 'SIM_DURATION', 'num_samples', 'num_features');

evalin('base', "load('biotac_simulink_params.mat')");

%% ============================================================
%  CREATE THE SIMULINK MODEL
%  ============================================================
fprintf('\nBuilding Simulink model: %s\n', MODEL_NAME);

if bdIsLoaded(MODEL_NAME)
    close_system(MODEL_NAME, 0);
end
new_system(MODEL_NAME); open_system(MODEL_NAME);

set_param(MODEL_NAME, ...
    'Solver', 'FixedStepDiscrete', 'FixedStep', num2str(SAMPLE_TIME), ...
    'StopTime', 'SIM_DURATION', 'EnablePacing', 'on', 'PacingRate', '0.2');

%% ============================================================
%  BLOCKS
%  ============================================================
% 1. Inputs
add_block('simulink/Sources/From Workspace', [MODEL_NAME '/Sensor Input'], ...
    'Position', [80 180 220 230], 'VariableName', 'sensor_input_struct', ...
    'SampleTime', num2str(SAMPLE_TIME), 'OutputAfterFinalValue', 'Cyclic repetition', 'Interpolate', 'off');

add_block('simulink/Sources/From Workspace', [MODEL_NAME '/Ground Truth'], ...
    'Position', [80 400 220 450], 'VariableName', 'ground_truth_struct', ...
    'SampleTime', num2str(SAMPLE_TIME), 'OutputAfterFinalValue', 'Cyclic repetition', 'Interpolate', 'off');

% Sum
add_block('simulink/Math Operations/Add', [MODEL_NAME '/Sensor + Feedback'], ...
    'Position', [300 185 330 215], 'Inputs', '++');

% Initialize Stateflow Root for MATLAB Functions (Fixes the slroot indexing error)
rt = sfroot;

% 2. Ensemble Classifier
blk_ensemble = [MODEL_NAME '/Ensemble Classifier'];
add_block('simulink/User-Defined Functions/MATLAB Function', blk_ensemble, 'Position', [400 170 580 240]);
ensemble_code = { ...
    'function p_slip = EnsembleClassifier(sensor_72ch)'; ...
    '%#codegen'; ...
    'coder.extrinsic(''predict''); coder.extrinsic(''load_finger_net'');'; ...
    'p_slip = 0; scores1 = zeros(1, 2); scores2 = zeros(1, 2); scores3 = zeros(1, 2);'; ...
    'persistent net1 net2 net3'; ...
    'if isempty(net1)'; ...
    '    net1 = load_finger_net(1); net2 = load_finger_net(2); net3 = load_finger_net(3);'; ...
    'end'; ...
    'if numel(sensor_72ch) == 72'; ...
    '    x = double(sensor_72ch(:)'');'; ...
    '    scores1 = double(predict(net1, x(1:24))); scores2 = double(predict(net2, x(25:48))); scores3 = double(predict(net3, x(49:72)));'; ...
    '    p_slip = (scores1(2) + scores2(2) + scores3(2)) / 3;'; ...
    'end; end'};
chart_ens = rt.find('-isa', 'Stateflow.EMChart', 'Path', blk_ensemble);
if ~isempty(chart_ens), chart_ens.Script = strjoin(ensemble_code, newline); end

% 3. Unified Slip Controller
blk_controller = [MODEL_NAME '/Slip Controller'];
add_block('simulink/User-Defined Functions/MATLAB Function', blk_controller, 'Position', [650 170 800 240]);
controller_code = { ...
    'function force_cmd = SlipController(p_slip)'; ...
    '%#codegen'; ...
    'persistent hold_timer'; ...
    'if isempty(hold_timer), hold_timer = 0; end'; ...
    ''; ...
    '% Config: 50ms hold (50 samples), 0.5 threshold'; ...
    'if p_slip > 0.5'; ...
    '    hold_timer = 50;'; ...
    'end'; ...
    ''; ...
    '% Output logic: 8N if timer active, 3N otherwise'; ...
    'if hold_timer > 0'; ...
    '    force_cmd = 8.0;'; ...
    '    hold_timer = hold_timer - 1;'; ...
    'else'; ...
    '    force_cmd = 3.0;'; ...
    'end; end'};
chart_ctrl = rt.find('-isa', 'Stateflow.EMChart', 'Path', blk_controller);
if ~isempty(chart_ctrl), chart_ctrl.Script = strjoin(controller_code, newline); end

% Feedback Path
add_block('simulink/Discrete/Delay', [MODEL_NAME '/Mechanical Delay'], ...
    'Position', [850 385 910 435], 'DelayLength', '1', 'InitialCondition', '3.0');

blk_plant = [MODEL_NAME '/Sensor Response'];
add_block('simulink/User-Defined Functions/MATLAB Function', blk_plant, 'Position', [650 380 800 440]);
plant_code = { ...
    'function sensor_offset = SensorResponse(grip_force)'; ...
    '%#codegen'; ...
    'sensor_offset = zeros(1, 72);'; ...
    'f_norm = max(0, min(1, (grip_force - 3.0) / 5.0));'; ...
    ''; ...
    '% INCREASED FEEDBACK: -2.0 shift completely suppresses the AI slip prediction'; ...
    'sensor_offset = (-2.0 * f_norm) * ones(1, 72);'; ...
    'end'};
chart_plant = rt.find('-isa', 'Stateflow.EMChart', 'Path', blk_plant);
if ~isempty(chart_plant), chart_plant.Script = strjoin(plant_code, newline); end

% Scopes & Sinks
add_block('simulink/Sinks/Scope', [MODEL_NAME '/Scope P(slip)'], 'Position', [650 100 700 140]);
add_block('simulink/Sinks/Scope', [MODEL_NAME '/Scope Grip Force'], 'Position', [900 190 950 220]);
add_block('simulink/Sinks/To Workspace', [MODEL_NAME '/Log Prediction'], 'Position', [900 260 1000 290], 'VariableName', 'slip_prediction', 'SaveFormat', 'Timeseries');
add_block('simulink/Sinks/To Workspace', [MODEL_NAME '/Log Ground Truth'], 'Position', [280 400 400 450], 'VariableName', 'ground_truth_log', 'SaveFormat', 'Timeseries');

%% ============================================================
%  WIRING
%  ============================================================
drawnow; pause(0.5);

connect_blocks(MODEL_NAME, 'Sensor Input', 1, 'Sensor + Feedback', 1);
connect_blocks(MODEL_NAME, 'Sensor + Feedback', 1, 'Ensemble Classifier', 1);

connect_blocks(MODEL_NAME, 'Ensemble Classifier', 1, 'Slip Controller', 1);
connect_blocks(MODEL_NAME, 'Ensemble Classifier', 1, 'Scope P(slip)', 1);

connect_blocks(MODEL_NAME, 'Slip Controller', 1, 'Scope Grip Force', 1);
connect_blocks(MODEL_NAME, 'Slip Controller', 1, 'Log Prediction', 1);
connect_blocks(MODEL_NAME, 'Slip Controller', 1, 'Mechanical Delay', 1);

connect_blocks(MODEL_NAME, 'Mechanical Delay', 1, 'Sensor Response', 1);
connect_blocks(MODEL_NAME, 'Sensor Response', 1, 'Sensor + Feedback', 2);
connect_blocks(MODEL_NAME, 'Ground Truth', 1, 'Log Ground Truth', 1);

try Simulink.BlockDiagram.arrangeSystem(MODEL_NAME); catch; end
save_system(MODEL_NAME);
fprintf('\nModel saved: %s.slx\n', MODEL_NAME);

function connect_blocks(sys, out_name, out_port, in_name, in_port)
    hOut = get_param([sys '/' out_name], 'PortHandles');
    hIn  = get_param([sys '/' in_name], 'PortHandles');
    try
        line_handle = add_line(sys, hOut.Outport(out_port), hIn.Inport(in_port));
        set_param(line_handle, 'autorouting', 'smart');
    catch ME
        fprintf('Warning: Could not connect %s to %s -> %s\n', out_name, in_name, ME.message);
    end
end