%% LOAD AND EXPLORE BIOTAC SP DATASET
%  Loads all 6 CSV files, combines them, explores distributions,
%  and creates visualisation figures for the presentation.
%
%  Requires: All 6 BioTac CSV files in the current directory
%  Outputs: biotac_data.mat, exploration figures

clc; clear; close all;

%% Load training data (3 orientations)
fprintf('Loading training data...\n');
train_down = readtable('bts3v2_palm_down.csv', 'ReadVariableNames', false);
train_side = readtable('bts3v2_palm_side.csv', 'ReadVariableNames', false);
train_45   = readtable('bts3v2_palm_45.csv',   'ReadVariableNames', false);

fprintf('Loading test data...\n');
test_down = readtable('bts3v2_palm_down_test.csv', 'ReadVariableNames', false);
test_side = readtable('bts3v2_palm_side_test.csv', 'ReadVariableNames', false);
test_45   = readtable('bts3v2_palm_45_test.csv',   'ReadVariableNames', false);

%% Identify column structure
% Column 1:      Object name (string)
% Column 2:      Label (0 = stable, 1 = slip)
% Columns 3-26:  Index finger (ff) electrode readings
% Columns 27-50: Middle finger (mf) electrode readings
% Columns 51-74: Thumb (th) electrode readings

num_electrodes = 24;
num_fingers = 3;
num_features = num_electrodes * num_fingers;  % 72

%% Extract features and labels from each table
[X_train_down, Y_train_down, obj_train_down] = extractData(train_down);
[X_train_side, Y_train_side, obj_train_side] = extractData(train_side);
[X_train_45,   Y_train_45,   obj_train_45]   = extractData(train_45);

[X_test_down, Y_test_down, obj_test_down] = extractData(test_down);
[X_test_side, Y_test_side, obj_test_side] = extractData(test_side);
[X_test_45,   Y_test_45,   obj_test_45]   = extractData(test_45);

%% Combine all orientations
X_train = [X_train_down; X_train_side; X_train_45];
Y_train = [Y_train_down; Y_train_side; Y_train_45];
obj_train = [obj_train_down; obj_train_side; obj_train_45];

% Track which orientation each sample came from
orient_train = [repmat({'palm_down'}, size(X_train_down,1), 1);
                repmat({'palm_side'}, size(X_train_side,1), 1);
                repmat({'palm_45'},   size(X_train_45,1),   1)];

X_test = [X_test_down; X_test_side; X_test_45];
Y_test = [Y_test_down; Y_test_side; Y_test_45];
obj_test = [obj_test_down; obj_test_side; obj_test_45];

orient_test = [repmat({'palm_down'}, size(X_test_down,1), 1);
               repmat({'palm_side'}, size(X_test_side,1), 1);
               repmat({'palm_45'},   size(X_test_45,1),   1)];

fprintf('\n=== DATASET SUMMARY ===\n');
fprintf('Training: %d samples x %d features\n', size(X_train));
fprintf('Test:     %d samples x %d features\n', size(X_test));

%% Check for NaN or invalid values
nan_train = sum(isnan(X_train(:)));
nan_test  = sum(isnan(X_test(:)));
fprintf('\nNaN values — Train: %d, Test: %d\n', nan_train, nan_test);

%% Class distribution
fprintf('\n--- Class Distribution ---\n');
fprintf('Training: Stable=%d (%.1f%%), Slip=%d (%.1f%%)\n', ...
    sum(Y_train==0), 100*mean(Y_train==0), ...
    sum(Y_train==1), 100*mean(Y_train==1));
fprintf('Test:     Stable=%d (%.1f%%), Slip=%d (%.1f%%)\n', ...
    sum(Y_test==0), 100*mean(Y_test==0), ...
    sum(Y_test==1), 100*mean(Y_test==1));

%% Orientation breakdown
fprintf('\n--- Orientation Breakdown (Training) ---\n');
for o = {'palm_down', 'palm_side', 'palm_45'}
    mask = strcmp(orient_train, o{1});
    n = sum(mask);
    s = sum(Y_train(mask) == 0);
    fprintf('  %s: %d total (%d stable, %d slip)\n', o{1}, n, s, n-s);
end

%% Save processed data
label_names = {'Stable', 'Slip'};
finger_names = {'Index (ff)', 'Middle (mf)', 'Thumb (th)'};

save('biotac_data.mat', ...
    'X_train', 'Y_train', 'obj_train', 'orient_train', ...
    'X_test',  'Y_test',  'obj_test',  'orient_test', ...
    'num_electrodes', 'num_fingers', 'num_features', ...
    'label_names', 'finger_names');

fprintf('\nSaved to biotac_data.mat\n');

%% ==================== VISUALISATIONS ====================

%% Figure 1: Class distribution bar chart
figure('Position', [100 100 800 400], 'Name', 'Class Distribution');

subplot(1,2,1);
bar([sum(Y_train==0) sum(Y_train==1)]);
set(gca, 'XTickLabel', label_names);
ylabel('Count'); title('Training Set');
text(1, sum(Y_train==0)+50, num2str(sum(Y_train==0)), 'HorizontalAlignment','center');
text(2, sum(Y_train==1)+50, num2str(sum(Y_train==1)), 'HorizontalAlignment','center');

subplot(1,2,2);
bar([sum(Y_test==0) sum(Y_test==1)]);
set(gca, 'XTickLabel', label_names);
ylabel('Count'); title('Test Set');
text(1, sum(Y_test==0)+10, num2str(sum(Y_test==0)), 'HorizontalAlignment','center');
text(2, sum(Y_test==1)+10, num2str(sum(Y_test==1)), 'HorizontalAlignment','center');

sgtitle('BioTac SP Dataset — Class Distribution');

%% Figure 2: Sample electrode heatmaps (stable vs slip)
figure('Position', [100 100 1200 600], 'Name', 'Electrode Heatmaps');

idx_stable = find(Y_train == 0, 1);
idx_slip   = find(Y_train == 1, 1);

for f = 1:3
    cols = (f-1)*24 + (1:24);
    
    subplot(2, 3, f);
    electrode_map = reshape(X_train(idx_stable, cols), [4, 6]);
    imagesc(electrode_map);
    colorbar; colormap(hot);
    title(sprintf('%s — Stable', finger_names{f}));
    xlabel('Electrode column'); ylabel('Electrode row');
    
    subplot(2, 3, f+3);
    electrode_map = reshape(X_train(idx_slip, cols), [4, 6]);
    imagesc(electrode_map);
    colorbar; colormap(hot);
    title(sprintf('%s — Slip', finger_names{f}));
    xlabel('Electrode column'); ylabel('Electrode row');
end
sgtitle('Sample Electrode Readings (Reshaped to 4x6 Grid)');

%% Figure 3: Feature distribution boxplots (first finger, selected electrodes)
figure('Position', [100 100 1000 400], 'Name', 'Feature Distributions');

electrodes_to_show = [1, 6, 12, 18, 24];
data_for_box = [];
groups = [];

for i = 1:numel(electrodes_to_show)
    e = electrodes_to_show(i);
    stable_vals = X_train(Y_train==0, e);
    slip_vals   = X_train(Y_train==1, e);
    
    data_for_box = [data_for_box; stable_vals; slip_vals];
    groups = [groups; repmat(2*i-1, numel(stable_vals), 1); repmat(2*i, numel(slip_vals), 1)];
end

boxplot(data_for_box, groups, 'Labels', ...
    reshape([strcat('E', string(electrodes_to_show), '-S'); ...
             strcat('E', string(electrodes_to_show), '-Sl')], 1, []));
ylabel('Electrode Reading');
title('Index Finger Electrode Distributions: Stable (S) vs Slip (Sl)');
xtickangle(45);

%% Figure 4: Mean electrode patterns
figure('Position', [100 100 1200 400], 'Name', 'Mean Electrode Patterns');

for f = 1:3
    cols = (f-1)*24 + (1:24);
    
    mean_stable = mean(X_train(Y_train==0, cols), 1);
    mean_slip   = mean(X_train(Y_train==1, cols), 1);
    
    subplot(1, 3, f);
    hold on;
    bar_data = [mean_stable; mean_slip]';
    bar(bar_data);
    legend('Stable', 'Slip', 'Location', 'northwest');
    xlabel('Electrode Index');
    ylabel('Mean Reading');
    title(finger_names{f});
    hold off;
end
sgtitle('Mean Electrode Readings by Class');

fprintf('\nDone. Check figures for data exploration.\n');

%% Helper function
function [X, Y, obj] = extractData(tbl)
    obj = tbl{:, 1};
    Y = tbl{:, 2};
    X = table2array(tbl(:, 3:end));
end