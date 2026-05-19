%% TRAIN BIOTAC GRASP STABILITY CLASSIFIER
%  Binary classification: stable (0) vs slip (1)
%  Using BioTac SP 72-electrode feature vector
%
%  FIXES APPLIED:
%    - Proper train/validation split (test set is held out, not used for
%      validation during training)
%    - Removed redundant double z-score normalisation
%    - Added per-finger and per-finger-pair baseline evaluation
%
%  Requires: biotac_data.mat (from step_1_load_biotac_data.m)
%  Requires: Deep Learning Toolbox
%  Outputs:  trained_biotac_model.mat, evaluation figures

clc; clear; close all;

%% Load data
load('biotac_data.mat');
fprintf('Loaded — Train: %d samples, Test: %d samples, Features: %d\n', ...
    size(X_train,1), size(X_test,1), num_features);

%% Create proper train/validation split (80/20 stratified from training set)
%  This prevents test-set leakage into training decisions.
rng(42);  % Reproducibility

idx_stable = find(Y_train == 0);
idx_slip   = find(Y_train == 1);

n_val_stable = round(0.2 * numel(idx_stable));
n_val_slip   = round(0.2 * numel(idx_slip));

perm_stable = idx_stable(randperm(numel(idx_stable)));
perm_slip   = idx_slip(randperm(numel(idx_slip)));

val_idx   = [perm_stable(1:n_val_stable); perm_slip(1:n_val_slip)];
train_idx = [perm_stable(n_val_stable+1:end); perm_slip(n_val_slip+1:end)];

X_tr  = X_train(train_idx, :);
Y_tr  = Y_train(train_idx);
X_val = X_train(val_idx, :);
Y_val = Y_train(val_idx);

fprintf('Split: %d train, %d validation, %d test (held out)\n', ...
    numel(Y_tr), numel(Y_val), numel(Y_test));

%% Normalise (z-score) — fit on training split only
mu    = mean(X_tr);
sigma = std(X_tr);
sigma(sigma == 0) = 1;  % Prevent division by zero

X_tr_norm   = (X_tr  - mu) ./ sigma;
X_val_norm  = (X_val - mu) ./ sigma;
X_test_norm = (X_test - mu) ./ sigma;

%% Convert labels to categorical
Y_tr_cat   = categorical(Y_tr);
Y_val_cat  = categorical(Y_val);
Y_test_cat = categorical(Y_test);

num_classes = 2;

fprintf('Class balance — Train: %.1f%% stable, %.1f%% slip\n', ...
    100*mean(Y_tr==0), 100*mean(Y_tr==1));

%% Define network architecture
layers = [
    featureInputLayer(num_features, 'Name', 'input', 'Normalization', 'none')
    
    fullyConnectedLayer(128, 'Name', 'fc1')
    batchNormalizationLayer('Name', 'bn1')
    reluLayer('Name', 'relu1')
    dropoutLayer(0.3, 'Name', 'drop1')
    
    fullyConnectedLayer(64, 'Name', 'fc2')
    batchNormalizationLayer('Name', 'bn2')
    reluLayer('Name', 'relu2')
    dropoutLayer(0.2, 'Name', 'drop2')
    
    fullyConnectedLayer(32, 'Name', 'fc3')
    reluLayer('Name', 'relu3')
    
    fullyConnectedLayer(num_classes, 'Name', 'fc_out')
    softmaxLayer('Name', 'softmax')
];

%% Training options — validation on held-out validation set (NOT test set)
options = trainingOptions('adam', ...
    'MaxEpochs', 100, ...
    'MiniBatchSize', 64, ...
    'InitialLearnRate', 1e-3, ...
    'LearnRateSchedule', 'piecewise', ...
    'LearnRateDropFactor', 0.5, ...
    'LearnRateDropPeriod', 30, ...
    'ValidationData', {X_val_norm, Y_val_cat}, ...
    'ValidationFrequency', 20, ...
    'ValidationPatience', 20, ...
    'L2Regularization', 1e-4, ...
    'Shuffle', 'every-epoch', ...
    'Verbose', true, ...
    'Plots', 'training-progress');

%% Train
fprintf('\n--- Training Neural Network (72 -> 128 -> 64 -> 32 -> 2) ---\n');

try
    [net, trainInfo] = trainnet(X_tr_norm, Y_tr_cat, layers, "crossentropy", options);
    use_trainnet = true;
catch
    layers_old = [layers; classificationLayer('Name', 'output')];
    [net, trainInfo] = trainNetwork(X_tr_norm, Y_tr_cat, layers_old, options);
    use_trainnet = false;
end

%% Predict on TEST set (untouched during training)
if use_trainnet
    Y_pred_scores = predict(net, X_test_norm);
    [~, Y_pred] = max(Y_pred_scores, [], 2);
    Y_pred = Y_pred - 1;
    Y_prob_slip = Y_pred_scores(:, 2);
else
    Y_pred_cat = classify(net, X_test_norm);
    Y_pred = double(Y_pred_cat) - 1;
    Y_pred_scores = predict(net, X_test_norm);
    Y_prob_slip = Y_pred_scores(:, 2);
end

%% Overall accuracy
accuracy = sum(Y_pred == Y_test) / numel(Y_test) * 100;
fprintf('\n=== TEST SET RESULTS ===\n');
fprintf('Overall accuracy: %.2f%%\n', accuracy);

%% Per-class metrics
fprintf('\n%-10s  %-10s  %-10s  %-10s  %-8s\n', 'Class', 'Precision', 'Recall', 'F1-Score', 'Support');
fprintf('%s\n', repmat('-', 1, 52));

precision_all = zeros(num_classes, 1);
recall_all = zeros(num_classes, 1);
f1_all = zeros(num_classes, 1);

for c = 0:1
    tp = sum(Y_pred == c & Y_test == c);
    fp = sum(Y_pred == c & Y_test ~= c);
    fn = sum(Y_pred ~= c & Y_test == c);
    support = sum(Y_test == c);
    
    p = tp / max(tp + fp, 1);
    r = tp / max(tp + fn, 1);
    f = 2 * p * r / max(p + r, 1e-10);
    
    precision_all(c+1) = p;
    recall_all(c+1) = r;
    f1_all(c+1) = f;
    
    fprintf('%-10s  %-10.3f  %-10.3f  %-10.3f  %-8d\n', ...
        label_names{c+1}, p, r, f, support);
end

fprintf('%s\n', repmat('-', 1, 52));
fprintf('%-10s  %-10.3f  %-10.3f  %-10.3f  %-8d\n', ...
    'Macro Avg', mean(precision_all), mean(recall_all), mean(f1_all), numel(Y_test));

%% Confusion matrix
figure('Position', [100 100 550 450], 'Name', 'NN Confusion Matrix');
cm = confusionchart(Y_test, Y_pred);
cm.Title = sprintf('Neural Network — Accuracy: %.1f%%', accuracy);
cm.ColumnSummary = 'column-normalized';
cm.RowSummary = 'row-normalized';

%% ROC curve
figure('Position', [700 100 550 450], 'Name', 'ROC Curve');
[fpr, tpr, thresholds] = perfcurve(Y_test, Y_prob_slip, 1);
auc = trapz(fpr, tpr);
plot(fpr, tpr, 'b-', 'LineWidth', 2);
hold on;
plot([0 1], [0 1], 'k--', 'LineWidth', 1);
xlabel('False Positive Rate');
ylabel('True Positive Rate');
title(sprintf('ROC Curve — AUC: %.3f', auc));
legend(sprintf('NN (AUC=%.3f)', auc), 'Random', 'Location', 'southeast');
grid on;

%% Training curves
figure('Position', [100 600 600 400], 'Name', 'Training History');
hold on;

has_history = false;
if isobject(trainInfo) && isprop(trainInfo, 'TrainingHistory')
    has_history = true;
elseif isstruct(trainInfo) && isfield(trainInfo, 'TrainingHistory')
    has_history = true;
end

if has_history
    hist_table = trainInfo.TrainingHistory;
    var_names = hist_table.Properties.VariableNames;
    iters = hist_table.Iteration;
    
    if ismember('TrainingLoss', var_names)
        train_loss = hist_table.TrainingLoss;
    elseif ismember('Loss', var_names)
        train_loss = hist_table.Loss;
    else
        train_loss = NaN(size(iters));
    end
    
    if ismember('ValidationLoss', var_names)
        val_loss = hist_table.ValidationLoss;
    else
        val_loss = NaN(size(iters));
    end
else
    iters = trainInfo.Iteration;
    train_loss = trainInfo.TrainingLoss;
    val_loss = trainInfo.ValidationLoss;
end

plot(iters, train_loss, 'b-', 'LineWidth', 0.8, 'DisplayName', 'Training loss');
valid_idx = ~isnan(val_loss);
if any(valid_idx)
    plot(iters(valid_idx), val_loss(valid_idx), ...
         'ro-', 'LineWidth', 1.2, 'MarkerSize', 5, 'DisplayName', 'Validation loss');
end
xlabel('Iteration'); ylabel('Cross-entropy Loss');
title('Training and Validation Loss');
legend('Location', 'northeast');
grid on;

%% Inference speed
fprintf('\n--- Inference Speed ---\n');
test_sample = X_test_norm(1, :);
num_trials = 1000;

tic;
for i = 1:num_trials
    predict(net, test_sample);
end
elapsed = toc;
nn_inference_ms = (elapsed / num_trials) * 1000;

fprintf('Average inference time: %.2f ms (over %d trials)\n', nn_inference_ms, num_trials);
fprintf('Real-time suitable (< 10ms): %s\n', string(nn_inference_ms < 10));

%% Model size estimate
model_info = whos('net');
nn_size_kb = model_info.bytes / 1024;
fprintf('Model size in memory: %.1f KB\n', nn_size_kb);

%% ========== PER-FINGER AND PER-PAIR BASELINES ==========
%  This was previously missing — Step 4 referenced these numbers without
%  a script to generate them. Now included for full reproducibility.

fprintf('\n%s\n', repmat('=', 1, 65));
fprintf('PER-FINGER BASELINE EVALUATION\n');
fprintf('%s\n', repmat('=', 1, 65));

finger_cols = {1:24, 25:48, 49:72};
finger_accs = zeros(1, 3);
finger_aucs = zeros(1, 3);
finger_nets_cell = cell(1, 3);
finger_mu_cell   = cell(1, 3);
finger_sig_cell  = cell(1, 3);

for f = 1:3
    cols = finger_cols{f};
    
    % Normalise per finger (fit on training split only)
    X_tr_f  = X_tr(:, cols);
    X_val_f = X_val(:, cols);
    X_te_f  = X_test(:, cols);
    
    mu_f  = mean(X_tr_f);
    sig_f = std(X_tr_f);
    sig_f(sig_f == 0) = 1;
    
    X_tr_fn  = (X_tr_f  - mu_f) ./ sig_f;
    X_val_fn = (X_val_f - mu_f) ./ sig_f;
    X_te_fn  = (X_te_f  - mu_f) ./ sig_f;
    
    finger_mu_cell{f}  = mu_f;
    finger_sig_cell{f} = sig_f;
    
    layers_f = [
        featureInputLayer(24, 'Name', 'input', 'Normalization', 'none')
        fullyConnectedLayer(64, 'Name', 'fc1')
        batchNormalizationLayer('Name', 'bn1')
        reluLayer('Name', 'relu1')
        dropoutLayer(0.3, 'Name', 'drop1')
        fullyConnectedLayer(32, 'Name', 'fc2')
        batchNormalizationLayer('Name', 'bn2')
        reluLayer('Name', 'relu2')
        fullyConnectedLayer(2, 'Name', 'fc_out')
        softmaxLayer('Name', 'softmax')
    ];
    
    opts_f = trainingOptions('adam', ...
        'MaxEpochs', 100, ...
        'MiniBatchSize', 64, ...
        'InitialLearnRate', 1e-3, ...
        'LearnRateSchedule', 'piecewise', ...
        'LearnRateDropFactor', 0.5, ...
        'LearnRateDropPeriod', 30, ...
        'ValidationData', {X_val_fn, Y_val_cat}, ...
        'ValidationFrequency', 20, ...
        'ValidationPatience', 15, ...
        'L2Regularization', 1e-4, ...
        'Shuffle', 'every-epoch', ...
        'Verbose', false, ...
        'Plots', 'none');
    
    try
        net_f = trainnet(X_tr_fn, Y_tr_cat, layers_f, "crossentropy", opts_f);
        sc = predict(net_f, X_te_fn);
        [~, pr] = max(sc, [], 2);
        pr = pr - 1;
        prob_slip_f = sc(:, 2);
    catch
        layers_f_old = [layers_f; classificationLayer('Name', 'output')];
        net_f = trainNetwork(X_tr_fn, Y_tr_cat, layers_f_old, opts_f);
        pr_cat = classify(net_f, X_te_fn);
        pr = double(pr_cat) - 1;
        sc = predict(net_f, X_te_fn);
        prob_slip_f = sc(:, 2);
    end
    
    finger_nets_cell{f} = net_f;
    finger_accs(f) = sum(pr == Y_test) / numel(Y_test) * 100;
    
    [fp_f, tp_f, ~] = perfcurve(Y_test, prob_slip_f, 1);
    finger_aucs(f) = trapz(fp_f, tp_f);
    
    fprintf('  %s: %.2f%% accuracy, AUC=%.3f\n', finger_names{f}, finger_accs(f), finger_aucs(f));
end

%% Per-finger-pair baselines
fprintf('\n--- Per-Finger-Pair Baselines ---\n');

pair_names = {'Index+Middle', 'Index+Thumb', 'Middle+Thumb'};
pair_cols  = {[1:24, 25:48], [1:24, 49:72], [25:48, 49:72]};
pair_accs  = zeros(1, 3);

for p = 1:3
    cols = pair_cols{p};
    n_feat = numel(cols);
    
    X_tr_p  = X_tr(:, cols);
    X_val_p = X_val(:, cols);
    X_te_p  = X_test(:, cols);
    
    mu_p  = mean(X_tr_p);
    sig_p = std(X_tr_p);
    sig_p(sig_p == 0) = 1;
    
    X_tr_pn  = (X_tr_p  - mu_p) ./ sig_p;
    X_val_pn = (X_val_p - mu_p) ./ sig_p;
    X_te_pn  = (X_te_p  - mu_p) ./ sig_p;
    
    layers_p = [
        featureInputLayer(n_feat, 'Name', 'input', 'Normalization', 'none')
        fullyConnectedLayer(96, 'Name', 'fc1')
        batchNormalizationLayer('Name', 'bn1')
        reluLayer('Name', 'relu1')
        dropoutLayer(0.3, 'Name', 'drop1')
        fullyConnectedLayer(48, 'Name', 'fc2')
        batchNormalizationLayer('Name', 'bn2')
        reluLayer('Name', 'relu2')
        dropoutLayer(0.2, 'Name', 'drop2')
        fullyConnectedLayer(2, 'Name', 'fc_out')
        softmaxLayer('Name', 'softmax')
    ];
    
    opts_p = trainingOptions('adam', ...
        'MaxEpochs', 100, ...
        'MiniBatchSize', 64, ...
        'InitialLearnRate', 1e-3, ...
        'LearnRateSchedule', 'piecewise', ...
        'LearnRateDropFactor', 0.5, ...
        'LearnRateDropPeriod', 30, ...
        'ValidationData', {X_val_pn, Y_val_cat}, ...
        'ValidationFrequency', 20, ...
        'ValidationPatience', 15, ...
        'L2Regularization', 1e-4, ...
        'Shuffle', 'every-epoch', ...
        'Verbose', false, ...
        'Plots', 'none');
    
    try
        net_p = trainnet(X_tr_pn, Y_tr_cat, layers_p, "crossentropy", opts_p);
        sc = predict(net_p, X_te_pn);
        [~, pr] = max(sc, [], 2);
        pr = pr - 1;
    catch
        layers_p_old = [layers_p; classificationLayer('Name', 'output')];
        net_p = trainNetwork(X_tr_pn, Y_tr_cat, layers_p_old, opts_p);
        pr_cat = classify(net_p, X_te_pn);
        pr = double(pr_cat) - 1;
    end
    
    pair_accs(p) = sum(pr == Y_test) / numel(Y_test) * 100;
    fprintf('  %s: %.2f%%\n', pair_names{p}, pair_accs(p));
end

%% Figure: Per-finger and per-pair results
figure('Position', [100 100 900 400], 'Name', 'Per-Finger Baselines');

subplot(1,2,1);
b = bar(finger_accs);
b.FaceColor = 'flat';
b.CData = [0.5 0.7 1.0; 0.3 0.8 0.4; 0.9 0.6 0.3];
set(gca, 'XTickLabel', finger_names, 'XTickLabelRotation', 15);
ylabel('Accuracy (%)');
title('Single Finger');
ylim([max(min(finger_accs)-15, 40), 100]);
grid on;
for i = 1:3
    text(i, finger_accs(i)+1, sprintf('%.1f%%', finger_accs(i)), ...
        'HorizontalAlignment', 'center', 'FontWeight', 'bold');
end

subplot(1,2,2);
b = bar(pair_accs);
b.FaceColor = 'flat';
b.CData = [0.4 0.6 0.9; 0.7 0.5 0.8; 0.2 0.7 0.5];
set(gca, 'XTickLabel', pair_names, 'XTickLabelRotation', 15);
ylabel('Accuracy (%)');
title('Finger Pairs');
ylim([max(min(pair_accs)-15, 40), 100]);
grid on;
for i = 1:3
    text(i, pair_accs(i)+1, sprintf('%.1f%%', pair_accs(i)), ...
        'HorizontalAlignment', 'center', 'FontWeight', 'bold');
end

sgtitle('Per-Finger and Per-Pair Baseline Accuracy');

[best_finger_acc, best_finger_idx] = max(finger_accs);
[best_pair_acc, best_pair_idx] = max(pair_accs);

fprintf('\nBest single finger: %s (%.2f%%)\n', finger_names{best_finger_idx}, best_finger_acc);
fprintf('Best finger pair:   %s (%.2f%%)\n', pair_names{best_pair_idx}, best_pair_acc);

%% Save everything
save('trained_biotac_model.mat', ...
    'net', 'mu', 'sigma', 'num_features', 'num_classes', ...
    'accuracy', 'precision_all', 'recall_all', 'f1_all', ...
    'auc', 'nn_inference_ms', 'nn_size_kb', ...
    'Y_pred', 'Y_prob_slip', 'Y_test', 'use_trainnet', ...
    'label_names', ...
    'finger_accs', 'finger_aucs', 'finger_names', ...
    'finger_nets_cell', 'finger_mu_cell', 'finger_sig_cell', ...
    'pair_accs', 'pair_names', ...
    'best_finger_acc', 'best_finger_idx', ...
    'best_pair_acc', 'best_pair_idx', ...
    'train_idx', 'val_idx');

fprintf('\nSaved trained model to trained_biotac_model.mat\n');
fprintf('Architecture: %d -> 128 -> 64 -> 32 -> %d\n', num_features, num_classes);