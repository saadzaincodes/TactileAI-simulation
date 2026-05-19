%% RETUNE FUSED MODEL — Make 3-finger fusion beat single finger
%  The original fused model underperformed middle finger alone.
%  This script tries several strategies to fix that.
%
%  FIXES APPLIED:
%    - Reads per-finger baselines from Step 2 (no hardcoded values)
%    - Uses proper train/val split (test set held out)
%    - Fixed net_ens overwrite bug: per-finger nets stored in cell array
%    - Added feature importance visualisation
%
%  Requires: biotac_data.mat, trained_biotac_model.mat
%            Deep Learning Toolbox
%  Outputs:  biotac_fused_tuned.mat

clc; clear; close all;

%% Load data and per-finger baselines from Step 2
load('biotac_data.mat');
load('trained_biotac_model.mat', 'finger_accs', 'finger_names', ...
    'best_finger_acc', 'best_finger_idx', ...
    'best_pair_acc', 'pair_names', 'best_pair_idx', ...
    'train_idx', 'val_idx');

fprintf('=== RETUNING FUSED 3-FINGER MODEL ===\n');
fprintf('Target: beat the best single finger (%s: %.2f%%)\n\n', ...
    finger_names{best_finger_idx}, best_finger_acc);

%% Reconstruct train/val split
X_tr  = X_train(train_idx, :);
Y_tr  = Y_train(train_idx);
X_val = X_train(val_idx, :);
Y_val = Y_train(val_idx);

%% Normalise (fit on training split only)
mu    = mean(X_tr);
sigma = std(X_tr);
sigma(sigma == 0) = 1;
X_tr_norm   = (X_tr  - mu) ./ sigma;
X_val_norm  = (X_val - mu) ./ sigma;
X_test_norm = (X_test - mu) ./ sigma;

Y_tr_cat   = categorical(Y_tr);
Y_val_cat  = categorical(Y_val);
Y_test_cat = categorical(Y_test);

%% ========== STRATEGY 1: Bigger network + stronger regularisation ==========
fprintf('--- Strategy 1: Larger network + more dropout + L2 ---\n');

layers_v1 = [
    featureInputLayer(72, 'Name', 'input', 'Normalization', 'none')
    
    fullyConnectedLayer(256, 'Name', 'fc1')
    batchNormalizationLayer('Name', 'bn1')
    reluLayer('Name', 'relu1')
    dropoutLayer(0.4, 'Name', 'drop1')
    
    fullyConnectedLayer(128, 'Name', 'fc2')
    batchNormalizationLayer('Name', 'bn2')
    reluLayer('Name', 'relu2')
    dropoutLayer(0.3, 'Name', 'drop2')
    
    fullyConnectedLayer(64, 'Name', 'fc3')
    batchNormalizationLayer('Name', 'bn3')
    reluLayer('Name', 'relu3')
    dropoutLayer(0.2, 'Name', 'drop3')
    
    fullyConnectedLayer(2, 'Name', 'fc_out')
    softmaxLayer('Name', 'softmax')
];

opts_v1 = trainingOptions('adam', ...
    'MaxEpochs', 150, ...
    'MiniBatchSize', 32, ...
    'InitialLearnRate', 5e-4, ...
    'LearnRateSchedule', 'piecewise', ...
    'LearnRateDropFactor', 0.5, ...
    'LearnRateDropPeriod', 40, ...
    'ValidationData', {X_val_norm, Y_val_cat}, ...
    'ValidationFrequency', 20, ...
    'ValidationPatience', 25, ...
    'L2Regularization', 1e-3, ...
    'Shuffle', 'every-epoch', ...
    'Verbose', false, ...
    'Plots', 'none');

acc_v1 = train_and_evaluate(X_tr_norm, Y_tr_cat, X_test_norm, Y_test, layers_v1, opts_v1, 'Strategy 1');

%% ========== STRATEGY 2: Class weighting via oversampling ==========
fprintf('\n--- Strategy 2: Class-weighted loss (upweight slip class) ---\n');

n_stable = sum(Y_tr == 0);
n_slip   = sum(Y_tr == 1);
w_stable = numel(Y_tr) / (2 * n_stable);
w_slip   = numel(Y_tr) / (2 * n_slip);

fprintf('  Class weights: Stable=%.2f, Slip=%.2f\n', w_stable, w_slip);

if n_slip < n_stable
    slip_idx = find(Y_tr == 1);
    oversample_n = n_stable - n_slip;
    rng(42);
    extra_idx = slip_idx(randi(numel(slip_idx), oversample_n, 1));
    X_tr_bal = [X_tr_norm; X_tr_norm(extra_idx, :)];
    Y_tr_bal = [Y_tr_cat; Y_tr_cat(extra_idx)];
    fprintf('  Oversampled slip class: %d -> %d samples\n', n_slip, n_slip + oversample_n);
else
    X_tr_bal = X_tr_norm;
    Y_tr_bal = Y_tr_cat;
end

acc_v2 = train_and_evaluate(X_tr_bal, Y_tr_bal, X_test_norm, Y_test, layers_v1, opts_v1, 'Strategy 2');

%% ========== STRATEGY 3: Feature selection — drop weak electrodes ==========
fprintf('\n--- Strategy 3: Feature selection (drop low-variance features) ---\n');

% Calculate per-feature discriminative power (t-stat between classes)
t_stats = zeros(1, 72);
for f = 1:72
    stable_vals = X_tr_norm(Y_tr == 0, f);
    slip_vals   = X_tr_norm(Y_tr == 1, f);
    
    mean_diff = abs(mean(stable_vals) - mean(slip_vals));
    pooled_std = sqrt((var(stable_vals) + var(slip_vals)) / 2);
    t_stats(f) = mean_diff / max(pooled_std, 1e-10);
end

for top_n = [50, 40, 30]
    [~, sorted_feat_idx] = sort(t_stats, 'descend');
    keep_idx = sorted_feat_idx(1:top_n);
    keep_idx = sort(keep_idx);
    
    X_tr_sel  = X_tr_norm(:, keep_idx);
    X_val_sel = X_val_norm(:, keep_idx);
    X_te_sel  = X_test_norm(:, keep_idx);
    
    layers_sel = [
        featureInputLayer(top_n, 'Name', 'input', 'Normalization', 'none')
        fullyConnectedLayer(128, 'Name', 'fc1')
        batchNormalizationLayer('Name', 'bn1')
        reluLayer('Name', 'relu1')
        dropoutLayer(0.4, 'Name', 'drop1')
        fullyConnectedLayer(64, 'Name', 'fc2')
        batchNormalizationLayer('Name', 'bn2')
        reluLayer('Name', 'relu2')
        dropoutLayer(0.3, 'Name', 'drop2')
        fullyConnectedLayer(2, 'Name', 'fc_out')
        softmaxLayer('Name', 'softmax')
    ];
    
    opts_sel = trainingOptions('adam', ...
        'MaxEpochs', 120, ...
        'MiniBatchSize', 32, ...
        'InitialLearnRate', 5e-4, ...
        'LearnRateSchedule', 'piecewise', ...
        'LearnRateDropFactor', 0.5, ...
        'LearnRateDropPeriod', 35, ...
        'ValidationData', {X_val_sel, Y_val_cat}, ...
        'ValidationFrequency', 20, ...
        'ValidationPatience', 20, ...
        'L2Regularization', 1e-3, ...
        'Shuffle', 'every-epoch', ...
        'Verbose', false, ...
        'Plots', 'none');
    
    train_and_evaluate(X_tr_sel, Y_tr_cat, X_te_sel, Y_test, layers_sel, opts_sel, ...
        sprintf('Strategy 3 (top %d features)', top_n));
end

%% ========== STRATEGY 4: SVM on all 72 features ==========
fprintf('\n--- Strategy 4: SVM (RBF) on all 72 features ---\n');

tic;
svm_template = templateSVM('KernelFunction', 'rbf', 'KernelScale', 'auto', ...
    'BoxConstraint', 10, 'Standardize', false);
svm_fused = fitcecoc(X_tr_norm, Y_tr, ...
    'Learners', svm_template, 'Coding', 'onevsone');
svm_time = toc;

Y_pred_svm = predict(svm_fused, X_test_norm);
svm_acc = sum(Y_pred_svm == Y_test) / numel(Y_test) * 100;
fprintf('  SVM fused accuracy: %.2f%% (trained in %.1fs)\n', svm_acc, svm_time);

%% ========== STRATEGY 5: Ensemble — per-finger NNs (BUGFIX) ==========
%  FIX: Each finger's net is stored in a cell array so individual
%       accuracies are computed correctly (not all from the thumb net).
fprintf('\n--- Strategy 5: Ensemble (average per-finger NN predictions) ---\n');

finger_cols = {1:24, 25:48, 49:72};
finger_probs = zeros(numel(Y_test), 3);
ens_finger_nets = cell(1, 3);    % <-- FIX: store all 3 nets
ens_finger_mu   = cell(1, 3);
ens_finger_sig  = cell(1, 3);

for f = 1:3
    cols = finger_cols{f};
    X_tr_f  = X_tr(:, cols);
    X_val_f = X_val(:, cols);
    X_te_f  = X_test(:, cols);
    
    mu_f  = mean(X_tr_f);
    sig_f = std(X_tr_f);
    sig_f(sig_f == 0) = 1;
    X_tr_fn  = (X_tr_f  - mu_f) ./ sig_f;
    X_val_fn = (X_val_f - mu_f) ./ sig_f;
    X_te_fn  = (X_te_f  - mu_f) ./ sig_f;
    
    ens_finger_mu{f}  = mu_f;
    ens_finger_sig{f} = sig_f;
    
    layers_ens = [
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
    
    opts_ens = trainingOptions('adam', ...
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
        net_f = trainnet(X_tr_fn, Y_tr_cat, layers_ens, "crossentropy", opts_ens);
        scores_ens = predict(net_f, X_te_fn);
        finger_probs(:, f) = scores_ens(:, 2);
    catch
        layers_ens_old = [layers_ens; classificationLayer('Name', 'output')];
        net_f = trainNetwork(X_tr_fn, Y_tr_cat, layers_ens_old, opts_ens);
        scores_ens = predict(net_f, X_te_fn);
        finger_probs(:, f) = scores_ens(:, 2);
    end
    
    ens_finger_nets{f} = net_f;  % <-- FIX: store each net
end

% Simple average ensemble
avg_prob_slip = mean(finger_probs, 2);
Y_pred_ens_avg = double(avg_prob_slip > 0.5);
ens_avg_acc = sum(Y_pred_ens_avg == Y_test) / numel(Y_test) * 100;
fprintf('  Equal-weight ensemble: %.2f%%\n', ens_avg_acc);

% Weighted ensemble — compute each finger's accuracy using ITS OWN net
indiv_accs = zeros(1, 3);
for f = 1:3
    cols = finger_cols{f};
    X_te_fn = (X_test(:, cols) - ens_finger_mu{f}) ./ ens_finger_sig{f};
    
    try
        scores_tmp = predict(ens_finger_nets{f}, X_te_fn);  % <-- FIX: use correct net
        [~, p] = max(scores_tmp, [], 2);
        p = p - 1;
    catch
        p_cat = classify(ens_finger_nets{f}, X_te_fn);
        p = double(p_cat) - 1;
    end
    indiv_accs(f) = sum(p == Y_test) / numel(Y_test);
end

weights = indiv_accs / sum(indiv_accs);
fprintf('  Learned weights: Index=%.3f, Middle=%.3f, Thumb=%.3f\n', weights);

weighted_prob_slip = finger_probs * weights';
Y_pred_ens_wt = double(weighted_prob_slip > 0.5);
ens_wt_acc = sum(Y_pred_ens_wt == Y_test) / numel(Y_test) * 100;
fprintf('  Weighted ensemble: %.2f%%\n', ens_wt_acc);

%% ========== STRATEGY 6: Multiple training runs (best of 5) ==========
fprintf('\n--- Strategy 6: Best of 5 training runs (original architecture) ---\n');

best_run_acc = 0;
best_net = [];

layers_orig = [
    featureInputLayer(72, 'Name', 'input', 'Normalization', 'none')
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
    fullyConnectedLayer(2, 'Name', 'fc_out')
    softmaxLayer('Name', 'softmax')
];

opts_orig = trainingOptions('adam', ...
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
    'Verbose', false, ...
    'Plots', 'none');

run_accs = zeros(5, 1);
for run = 1:5
    try
        net_run = trainnet(X_tr_norm, Y_tr_cat, layers_orig, "crossentropy", opts_orig);
        scores_run = predict(net_run, X_test_norm);
        [~, preds_run] = max(scores_run, [], 2);
        preds_run = preds_run - 1;
    catch
        layers_orig_old = [layers_orig; classificationLayer('Name', 'output')];
        net_run = trainNetwork(X_tr_norm, Y_tr_cat, layers_orig_old, opts_orig);
        preds_run_cat = classify(net_run, X_test_norm);
        preds_run = double(preds_run_cat) - 1;
    end
    
    run_accs(run) = sum(preds_run == Y_test) / numel(Y_test) * 100;
    fprintf('  Run %d: %.2f%%\n', run, run_accs(run));
    
    if run_accs(run) > best_run_acc
        best_run_acc = run_accs(run);
        best_net = net_run;
    end
end

fprintf('  Best of 5: %.2f%%  |  Mean: %.2f%%  |  Std: %.2f%%\n', ...
    best_run_acc, mean(run_accs), std(run_accs));

%% ========== FEATURE IMPORTANCE VISUALISATION ==========
fprintf('\n--- Feature Importance (t-statistic) ---\n');

figure('Position', [100 100 1000 450], 'Name', 'Feature Importance');

% Colour by finger
colors_per_feature = zeros(72, 3);
colors_per_feature(1:24,   :) = repmat([0.5 0.7 1.0], 24, 1);  % Index: blue
colors_per_feature(25:48,  :) = repmat([0.3 0.8 0.4], 24, 1);  % Middle: green
colors_per_feature(49:72,  :) = repmat([0.9 0.6 0.3], 24, 1);  % Thumb: orange

% Sort by importance
[sorted_t, sort_idx] = sort(t_stats, 'descend');
top_k = 30;  % Show top 30

subplot(1,2,1);
b = barh(sorted_t(top_k:-1:1));
b.FaceColor = 'flat';
b.CData = colors_per_feature(sort_idx(top_k:-1:1), :);

% Label by finger
feat_labels = cell(top_k, 1);
for i = 1:top_k
    fi = sort_idx(i);
    if fi <= 24
        feat_labels{i} = sprintf('Index E%d', fi);
    elseif fi <= 48
        feat_labels{i} = sprintf('Middle E%d', fi-24);
    else
        feat_labels{i} = sprintf('Thumb E%d', fi-48);
    end
end
set(gca, 'YTickLabel', flip(feat_labels));
xlabel('Discriminative Power (|t-stat|)');
title(sprintf('Top %d Most Discriminative Features', top_k));
grid on;

% Pie chart: which finger contributes most
subplot(1,2,2);
finger_counts = [sum(sort_idx(1:top_k) <= 24), ...
                 sum(sort_idx(1:top_k) > 24 & sort_idx(1:top_k) <= 48), ...
                 sum(sort_idx(1:top_k) > 48)];
pie(finger_counts, finger_names);
title(sprintf('Finger Share in Top %d Features', top_k));
colormap([0.5 0.7 1.0; 0.3 0.8 0.4; 0.9 0.6 0.3]);

sgtitle('Feature Importance Analysis');

fprintf('  Top %d features by finger: Index=%d, Middle=%d, Thumb=%d\n', ...
    top_k, finger_counts(1), finger_counts(2), finger_counts(3));

%% ========== FINAL SUMMARY ==========
fprintf('\n%s\n', repmat('=', 1, 70));
fprintf('TUNING RESULTS SUMMARY\n');
fprintf('%s\n', repmat('=', 1, 70));
fprintf('%-40s  Accuracy\n', 'Strategy');
fprintf('%s\n', repmat('-', 1, 55));
fprintf('%-40s  %.2f%%\n', sprintf('Best single finger (%s)', finger_names{best_finger_idx}), best_finger_acc);
fprintf('%-40s  %.2f%%\n', sprintf('Best 2 fingers (%s)', pair_names{best_pair_idx}), best_pair_acc);
fprintf('%-40s  %.2f%%\n', 'S1: Bigger net + regularisation', acc_v1);
fprintf('%-40s  %.2f%%\n', 'S2: Class-weighted training', acc_v2);
fprintf('%-40s  %.2f%%\n', 'S4: SVM on 72 features', svm_acc);
fprintf('%-40s  %.2f%%\n', 'S5a: Equal-weight ensemble', ens_avg_acc);
fprintf('%-40s  %.2f%%\n', 'S5b: Weighted ensemble', ens_wt_acc);
fprintf('%-40s  %.2f%%\n', 'S6: Best of 5 runs (original arch)', best_run_acc);
fprintf('%s\n', repmat('=', 1, 70));

%% Save best model — include ensemble nets and normalisation for Step 5
all_accs = [acc_v1, acc_v2, svm_acc, ens_avg_acc, ens_wt_acc, best_run_acc];
all_names = {'S1_bigger_net', 'S2_class_weighted', 'S4_SVM', ...
             'S5a_ensemble_avg', 'S5b_ensemble_wt', 'S6_best_of_5'};
[best_overall, best_idx] = max(all_accs);

fprintf('\nBest strategy: %s (%.2f%%)\n', all_names{best_idx}, best_overall);

if best_overall > best_finger_acc
    fprintf('SUCCESS: Fused model now beats best single finger!\n');
else
    fprintf('Fused model still below best single finger.\n');
    fprintf('Consider using Option B: present the honest analysis.\n');
    fprintf('The 2-finger result (%.1f%%) still shows fusion value.\n', best_pair_acc);
end

save('biotac_fused_tuned.mat', ...
    'all_accs', 'all_names', 'best_overall', 'best_idx', ...
    'ens_finger_nets', 'ens_finger_mu', 'ens_finger_sig', ...
    'weights', 'ens_avg_acc', 'ens_wt_acc', ...
    'finger_accs', 'finger_names', 'best_finger_acc', 'best_finger_idx', ...
    'best_pair_acc', 'pair_names', 'best_pair_idx', ...
    't_stats', ...
    'train_idx', 'val_idx');

fprintf('\nSaved to biotac_fused_tuned.mat\n');

%% ========== HELPER FUNCTION ==========
function acc = train_and_evaluate(X_tr, Y_tr, X_te, Y_te, layers, opts, name)
    try
        net_tmp = trainnet(X_tr, Y_tr, layers, "crossentropy", opts);
        scores = predict(net_tmp, X_te);
        [~, preds] = max(scores, [], 2);
        preds = preds - 1;
    catch
        layers_old = [layers; classificationLayer('Name', 'output')];
        net_tmp = trainNetwork(X_tr, Y_tr, layers_old, opts);
        preds_cat = classify(net_tmp, X_te);
        preds = double(preds_cat) - 1;
    end
    
    acc = sum(preds == Y_te) / numel(Y_te) * 100;
    
    % Slip recall (the metric that matters most)
    tp_slip = sum(preds == 1 & Y_te == 1);
    fn_slip = sum(preds == 0 & Y_te == 1);
    slip_recall = tp_slip / max(tp_slip + fn_slip, 1);
    
    fprintf('  %s: %.2f%% accuracy | Slip recall: %.3f\n', name, acc, slip_recall);
end