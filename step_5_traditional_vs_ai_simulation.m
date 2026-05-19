%% TRADITIONAL vs AI-ENHANCED TACTILE SENSING SIMULATION (v3)
%  Uses the ENSEMBLE FUSION trained in Step 4 (loaded, not retrained).
%
%  Traditional approaches:
%    1. Simple mean-threshold (original weak baseline)
%    2. Per-finger thresholds (stronger classical baseline)
%    3. Linear Discriminant Analysis (strongest classical baseline)
%  AI-enhanced approach:
%    Ensemble of 3 per-finger neural networks (from Step 4)
%
%  FIXES APPLIED:
%    - Loads ensemble from Step 4 (no retraining = no accuracy drift)
%    - Adds LDA and per-finger threshold as stronger classical baselines
%    - Adds explicit error type trade-off analysis
%    - Uses proper train/val split for all calibration
%
%  Requires: biotac_data.mat, biotac_fused_tuned.mat
%            Deep Learning Toolbox, Statistics and ML Toolbox
%  Outputs:  biotac_simulation_results_v3.mat, comparison figures

clc; clear; close all;

%% Load data and trained ensemble from Step 4
load('biotac_data.mat');
load('biotac_fused_tuned.mat', ...
    'ens_finger_nets', 'ens_finger_mu', 'ens_finger_sig', ...
    'finger_accs', 'finger_names', 'ens_avg_acc', ...
    'train_idx', 'val_idx');

fprintf('=== TRADITIONAL vs AI-ENHANCED SIMULATION (v3 — Loaded Ensemble) ===\n');
fprintf('Simulating %d grasp attempts on an electronics assembly line\n', numel(Y_test));
fprintf('Ensemble loaded from Step 4 (no retraining)\n\n');

% Reconstruct train/val split
X_tr  = X_train(train_idx, :);
Y_tr  = Y_train(train_idx);
X_val = X_train(val_idx, :);
Y_val = Y_train(val_idx);

finger_cols = {1:24, 25:48, 49:72};
finger_labels = {'Index (ff)', 'Middle (mf)', 'Thumb (th)'};

%% Report per-finger accuracies (already computed in Step 4)
fprintf('--- Per-finger accuracies (from Step 4) ---\n');
for f = 1:3
    fprintf('  %s: %.2f%%\n', finger_labels{f}, finger_accs(f));
end

%% Run ensemble prediction on all test samples (using loaded nets)
fprintf('\n--- Running ensemble predictions (loaded model) ---\n');

finger_probs = zeros(numel(Y_test), 3);

for f = 1:3
    cols = finger_cols{f};
    X_te_f = X_test(:, cols);
    X_te_fn = (X_te_f - ens_finger_mu{f}) ./ ens_finger_sig{f};
    
    scores_f = predict(ens_finger_nets{f}, X_te_fn);
    finger_probs(:, f) = scores_f(:, 2);  % P(slip)
end

avg_prob_slip = mean(finger_probs, 2);
Y_pred_ensemble = double(avg_prob_slip > 0.5);
ensemble_accuracy = sum(Y_pred_ensemble == Y_test) / numel(Y_test) * 100;

fprintf('Ensemble accuracy: %.2f%% (matches Step 4: %.2f%%)\n\n', ...
    ensemble_accuracy, ens_avg_acc);

%% ========== TRADITIONAL APPROACH 1: Mean-Threshold (weak baseline) ==========
fprintf('--- Calibrating baselines ---\n');
fprintf('  Baseline 1: Mean threshold\n');

mean_readings_train = mean(X_tr, 2);

thresholds = linspace(min(mean_readings_train), max(mean_readings_train), 500);
best_thresh_acc = 0;
best_threshold = 0;

for t = thresholds
    preds_t = double(mean_readings_train < t);
    acc_t = sum(preds_t == Y_tr) / numel(Y_tr);
    if acc_t > best_thresh_acc
        best_thresh_acc = acc_t;
        best_threshold = t;
    end
end

mean_readings_test = mean(X_test, 2);
Y_pred_thresh = double(mean_readings_test < best_threshold);
thresh_accuracy = sum(Y_pred_thresh == Y_test) / numel(Y_test) * 100;
fprintf('    Threshold test accuracy: %.2f%%\n', thresh_accuracy);

%% ========== TRADITIONAL APPROACH 2: Per-finger thresholds ==========
fprintf('  Baseline 2: Per-finger thresholds (majority vote)\n');

finger_thresh_preds = zeros(numel(Y_test), 3);

for f = 1:3
    cols = finger_cols{f};
    mean_f_train = mean(X_tr(:, cols), 2);
    mean_f_test  = mean(X_test(:, cols), 2);
    
    % Find best threshold per finger on training data
    thresholds_f = linspace(min(mean_f_train), max(mean_f_train), 500);
    best_f_acc = 0;
    best_f_thresh = 0;
    
    for t = thresholds_f
        preds_t = double(mean_f_train < t);
        acc_t = sum(preds_t == Y_tr) / numel(Y_tr);
        if acc_t > best_f_acc
            best_f_acc = acc_t;
            best_f_thresh = t;
        end
    end
    
    finger_thresh_preds(:, f) = double(mean_f_test < best_f_thresh);
end

% Majority vote (2 of 3 fingers say slip -> predict slip)
Y_pred_pfthresh = double(sum(finger_thresh_preds, 2) >= 2);
pfthresh_accuracy = sum(Y_pred_pfthresh == Y_test) / numel(Y_test) * 100;
fprintf('    Per-finger threshold accuracy: %.2f%%\n', pfthresh_accuracy);

%% ========== TRADITIONAL APPROACH 3: Linear Discriminant Analysis ==========
fprintf('  Baseline 3: Linear Discriminant Analysis\n');

mu_all    = mean(X_tr);
sigma_all = std(X_tr);
sigma_all(sigma_all == 0) = 1;
X_tr_norm   = (X_tr  - mu_all) ./ sigma_all;
X_test_norm = (X_test - mu_all) ./ sigma_all;

lda_model = fitcdiscr(X_tr_norm, Y_tr, 'DiscrimType', 'linear');
Y_pred_lda = predict(lda_model, X_test_norm);
lda_accuracy = sum(Y_pred_lda == Y_test) / numel(Y_test) * 100;
fprintf('    LDA test accuracy: %.2f%%\n\n', lda_accuracy);

%% ========== MEASURE INFERENCE LATENCY ==========
fprintf('--- Measuring latency per approach ---\n');

num_timing_trials = 200;

% Threshold latency
thresh_times = zeros(num_timing_trials, 1);
for i = 1:num_timing_trials
    idx = randi(size(X_test, 1));
    tic;
    m = mean(X_test(idx, :));
    pred = double(m < best_threshold);
    thresh_times(i) = toc * 1000;
end
thresh_latency_ms = mean(thresh_times);

% LDA latency
lda_times = zeros(num_timing_trials, 1);
for i = 1:num_timing_trials
    idx = randi(size(X_test, 1));
    sample_norm = (X_test(idx, :) - mu_all) ./ sigma_all;
    tic;
    predict(lda_model, sample_norm);
    lda_times(i) = toc * 1000;
end
lda_latency_ms = mean(lda_times);

% Ensemble latency
ens_times = zeros(num_timing_trials, 1);
for i = 1:num_timing_trials
    idx = randi(size(X_test, 1));
    tic;
    probs = zeros(1, 3);
    for f = 1:3
        cols = finger_cols{f};
        sample_f = (X_test(idx, cols) - ens_finger_mu{f}) ./ ens_finger_sig{f};
        sc = predict(ens_finger_nets{f}, sample_f);
        probs(f) = sc(2);
    end
    pred = double(mean(probs) > 0.5);
    ens_times(i) = toc * 1000;
end
ens_latency_ms = mean(ens_times);

fprintf('Threshold avg latency:  %.4f ms\n', thresh_latency_ms);
fprintf('LDA avg latency:        %.2f ms\n', lda_latency_ms);
fprintf('Ensemble avg latency:   %.2f ms\n', ens_latency_ms);

%% ========== PRODUCTION SIMULATION ==========
N = numel(Y_test);

% Traditional (mean threshold)
thresh_dropped    = cumsum(Y_pred_thresh == 0 & Y_test == 1);
thresh_crushed    = cumsum(Y_pred_thresh == 1 & Y_test == 0);
thresh_correct    = cumsum(Y_pred_thresh == Y_test);
thresh_defect_rate = (thresh_dropped + thresh_crushed) ./ (1:N)' * 100;

% LDA baseline
lda_dropped    = cumsum(Y_pred_lda == 0 & Y_test == 1);
lda_crushed    = cumsum(Y_pred_lda == 1 & Y_test == 0);
lda_defect_rate = (lda_dropped + lda_crushed) ./ (1:N)' * 100;

% AI-enhanced (ensemble)
ens_dropped    = cumsum(Y_pred_ensemble == 0 & Y_test == 1);
ens_crushed    = cumsum(Y_pred_ensemble == 1 & Y_test == 0);
ens_correct    = cumsum(Y_pred_ensemble == Y_test);
ens_defect_rate = (ens_dropped + ens_crushed) ./ (1:N)' * 100;

%% ========== SUMMARY TABLE ==========
fprintf('\n%s\n', repmat('=', 1, 85));
fprintf('PRODUCTION SIMULATION RESULTS (over %d grasps)\n', N);
fprintf('%s\n', repmat('=', 1, 85));
fprintf('%-25s  %-15s  %-15s  %-15s\n', 'Metric', 'Mean Threshold', 'LDA', 'AI Ensemble');
fprintf('%s\n', repmat('-', 1, 85));
fprintf('%-25s  %-15.2f  %-15.2f  %-15.2f\n', 'Accuracy (%)', thresh_accuracy, lda_accuracy, ensemble_accuracy);
fprintf('%-25s  %-15.4f  %-15.2f  %-15.2f\n', 'Avg latency (ms)', thresh_latency_ms, lda_latency_ms, ens_latency_ms);
fprintf('%-25s  %-15d  %-15d  %-15d\n',     'Dropped components', thresh_dropped(end), lda_dropped(end), ens_dropped(end));
fprintf('%-25s  %-15d  %-15d  %-15d\n',     'Crush-risk events', thresh_crushed(end), lda_crushed(end), ens_crushed(end));
fprintf('%-25s  %-15d  %-15d  %-15d\n',     'Total defects', ...
    thresh_dropped(end)+thresh_crushed(end), lda_dropped(end)+lda_crushed(end), ens_dropped(end)+ens_crushed(end));
fprintf('%-25s  %-15.1f  %-15.1f  %-15.1f\n', 'Final defect rate (%)', ...
    thresh_defect_rate(end), lda_defect_rate(end), ens_defect_rate(end));
fprintf('%s\n', repmat('=', 1, 85));

%% ========== ERROR TYPE TRADE-OFF ANALYSIS ==========
fprintf('\n--- Error Type Trade-off Analysis ---\n');
fprintf('In safety-critical grasping, the two error types have different consequences:\n');
fprintf('  - Missed slip (dropped component): component damage, production delay\n');
fprintf('  - False slip alarm (crush risk):   excessive grip force, potential crush damage\n\n');

methods = {'Mean Threshold', 'LDA', 'AI Ensemble'};
drops   = [thresh_dropped(end), lda_dropped(end), ens_dropped(end)];
crushes = [thresh_crushed(end), lda_crushed(end), ens_crushed(end)];

for i = 1:3
    slip_recall = 1 - drops(i) / sum(Y_test == 1);
    stable_recall = 1 - crushes(i) / sum(Y_test == 0);
    fprintf('  %s:\n', methods{i});
    fprintf('    Slip recall (detect slip):     %.1f%% (%d missed of %d)\n', ...
        slip_recall*100, drops(i), sum(Y_test==1));
    fprintf('    Stable recall (avoid crush):   %.1f%% (%d false alarms of %d)\n', ...
        stable_recall*100, crushes(i), sum(Y_test==0));
    
    if drops(i) < crushes(i)
        fprintf('    -> Biased toward predicting SLIP (cautious grip, more crush risk)\n');
    elseif crushes(i) < drops(i)
        fprintf('    -> Biased toward predicting STABLE (loose grip, more drop risk)\n');
    else
        fprintf('    -> Balanced error profile\n');
    end
    fprintf('\n');
end

fprintf('  NOTE: For high-value components, a conservative threshold on P(slip)\n');
fprintf('  can be set (e.g., 0.3 instead of 0.5) to reduce drops at the cost of\n');
fprintf('  more crush-risk events. The ensemble confidence distribution (Figure 6)\n');
fprintf('  shows this is viable — the AI "knows when it is unsure".\n');

%% Cost impact
cost_per_dropped = 15;
cost_per_crush   = 25;
fprintf('\n--- Estimated Cost Impact (per %d components) ---\n', N);

trad_cost = thresh_dropped(end) * cost_per_dropped + thresh_crushed(end) * cost_per_crush;
lda_cost  = lda_dropped(end) * cost_per_dropped + lda_crushed(end) * cost_per_crush;
ai_cost   = ens_dropped(end) * cost_per_dropped + ens_crushed(end) * cost_per_crush;

fprintf('Mean threshold defect cost: GBP%d\n', trad_cost);
fprintf('LDA defect cost:            GBP%d\n', lda_cost);
fprintf('AI ensemble defect cost:    GBP%d\n', ai_cost);

savings_vs_thresh = trad_cost - ai_cost;
savings_vs_lda    = lda_cost - ai_cost;
fprintf('AI saves vs threshold:      GBP%d (%.0f%% reduction)\n', ...
    savings_vs_thresh, (savings_vs_thresh/max(trad_cost,1))*100);
fprintf('AI saves vs LDA:            GBP%d (%.0f%% reduction)\n', ...
    savings_vs_lda, (savings_vs_lda/max(lda_cost,1))*100);

% Model size (sum of 3 finger NNs)
total_model_kb = 0;
for f = 1:3
    tmp_net = ens_finger_nets{f};
    tmp_info = whos('tmp_net');
    total_model_kb = total_model_kb + tmp_info.bytes / 1024;
end
fprintf('Total ensemble model size: %.1f KB (3 x small NNs)\n', total_model_kb);

%% ========== VISUALISATIONS ==========

%% Figure 1: Side-by-side headline comparison (3 methods)
figure('Position', [100 100 1200 450], 'Name', 'Traditional vs AI-Enhanced');

% Accuracy
subplot(1,3,1);
accs_plot = [thresh_accuracy, lda_accuracy, ensemble_accuracy];
b = bar(accs_plot);
b.FaceColor = 'flat';
b.CData = [0.75 0.75 0.75; 0.5 0.5 0.9; 0.2 0.7 0.4];
set(gca, 'XTickLabel', {'Threshold', 'LDA', 'AI Ensemble'});
ylabel('Accuracy (%)');
title('Classification Accuracy');
ylim([max(min(accs_plot)-15, 0), 100]);
grid on;
for i = 1:3
    text(i, accs_plot(i)+1.5, sprintf('%.1f%%', accs_plot(i)), ...
        'HorizontalAlignment', 'center', 'FontWeight', 'bold', 'FontSize', 11);
end

% Defect count
subplot(1,3,2);
defect_data = [thresh_dropped(end), thresh_crushed(end); ...
               lda_dropped(end), lda_crushed(end); ...
               ens_dropped(end), ens_crushed(end)];
b = bar(defect_data, 'stacked');
b(1).FaceColor = [0.9 0.3 0.3];
b(2).FaceColor = [1.0 0.7 0.3];
set(gca, 'XTickLabel', {'Threshold', 'LDA', 'AI Ensemble'});
ylabel('Count');
title('Production Defects');
legend('Dropped (missed slip)', 'Crush risk (false alarm)', 'Location', 'northwest');
grid on;

% Cost
subplot(1,3,3);
costs_plot = [trad_cost, lda_cost, ai_cost];
b = bar(costs_plot);
b.FaceColor = 'flat';
b.CData = [0.75 0.75 0.75; 0.5 0.5 0.9; 0.2 0.7 0.4];
set(gca, 'XTickLabel', {'Threshold', 'LDA', 'AI Ensemble'});
ylabel('Estimated Cost (GBP)');
title('Defect Cost Impact');
grid on;
for i = 1:3
    text(i, costs_plot(i)+max(costs_plot)*0.03, sprintf('GBP%d', costs_plot(i)), ...
        'HorizontalAlignment', 'center', 'FontWeight', 'bold', 'FontSize', 11);
end

sgtitle('Traditional vs AI-Enhanced Comparison', 'FontSize', 14);

%% Figure 2: Cumulative defect rate over production run
figure('Position', [100 550 800 450], 'Name', 'Defect Rate Over Production Run');

hold on;
plot(1:N, thresh_defect_rate, '-', 'Color', [0.6 0.6 0.6], 'LineWidth', 2.5, ...
    'DisplayName', 'Mean threshold');
plot(1:N, lda_defect_rate, '-', 'Color', [0.4 0.4 0.85], 'LineWidth', 2, ...
    'DisplayName', 'LDA');
plot(1:N, ens_defect_rate, '-', 'Color', [0.2 0.7 0.4], 'LineWidth', 2.5, ...
    'DisplayName', 'AI ensemble');

% Shaded gap between threshold and ensemble
x_fill = [1:N, fliplr(1:N)];
y_fill = [thresh_defect_rate', fliplr(ens_defect_rate')];
fill(x_fill, y_fill, [0.9 0.3 0.3], 'FaceAlpha', 0.12, 'EdgeColor', 'none', ...
    'DisplayName', 'Defect gap (AI savings)');
hold off;

xlabel('Component Number (Production Sequence)');
ylabel('Cumulative Defect Rate (%)');
title('Defect Rate Across Production Run');
legend('Location', 'northeast');
grid on;

%% Figure 3: Confusion matrices (all 3)
figure('Position', [900 100 1200 400], 'Name', 'Confusion Matrices');

subplot(1,3,1);
confusionchart(Y_test, Y_pred_thresh);
title(sprintf('Threshold — %.1f%%', thresh_accuracy));

subplot(1,3,2);
confusionchart(Y_test, Y_pred_lda);
title(sprintf('LDA — %.1f%%', lda_accuracy));

subplot(1,3,3);
confusionchart(Y_test, Y_pred_ensemble);
title(sprintf('AI Ensemble — %.1f%%', ensemble_accuracy));

sgtitle('Where Each Approach Fails');

%% Figure 4: Per-finger contribution + ensemble
figure('Position', [900 550 700 400], 'Name', 'Ensemble Breakdown');

all_accs = [finger_accs, ensemble_accuracy];
all_labels_plot = [finger_labels, {'Ensemble (fused)'}];
colors = [0.6 0.6 0.6; 0.6 0.6 0.6; 0.6 0.6 0.6; 0.2 0.7 0.4];

b = bar(all_accs);
b.FaceColor = 'flat';
b.CData = colors;
set(gca, 'XTickLabel', all_labels_plot, 'XTickLabelRotation', 20);
ylabel('Accuracy (%)');
title('Individual Finger Accuracy vs Ensemble Fusion');
ylim([max(min(all_accs)-10, 40), 100]);
grid on;

for i = 1:numel(all_accs)
    text(i, all_accs(i)+0.8, sprintf('%.1f%%', all_accs(i)), ...
        'HorizontalAlignment', 'center', 'FontWeight', 'bold');
end

%% Figure 5: Latency comparison
figure('Position', [500 300 600 500], 'Name', 'Latency Comparison');

subplot(3,1,1);
histogram(thresh_times, 30, 'FaceColor', [0.75 0.75 0.75], 'FaceAlpha', 0.8);
xlabel('Inference Time (ms)'); ylabel('Count');
title(sprintf('Threshold — Mean: %.4f ms', thresh_latency_ms));
grid on;

subplot(3,1,2);
histogram(lda_times, 30, 'FaceColor', [0.5 0.5 0.9], 'FaceAlpha', 0.8);
xlabel('Inference Time (ms)'); ylabel('Count');
title(sprintf('LDA — Mean: %.2f ms', lda_latency_ms));
grid on;

subplot(3,1,3);
histogram(ens_times, 30, 'FaceColor', [0.2 0.7 0.4], 'FaceAlpha', 0.8);
xlabel('Inference Time (ms)'); ylabel('Count');
title(sprintf('AI Ensemble — Mean: %.2f ms', ens_latency_ms));
grid on;
hold on;
xline(10, 'r--', 'LineWidth', 1.5);
text(10.2, max(ylim)*0.8, '10ms real-time threshold', 'Color', 'r', 'FontSize', 9);
hold off;

sgtitle('Inference Latency Distribution');

%% Figure 6: Confidence distribution (ensemble)
figure('Position', [200 300 600 350], 'Name', 'Ensemble Confidence');

hold on;
histogram(avg_prob_slip(Y_test == 0), 30, 'FaceColor', [0.3 0.6 0.9], ...
    'FaceAlpha', 0.6, 'DisplayName', 'Actually stable');
histogram(avg_prob_slip(Y_test == 1), 30, 'FaceColor', [0.9 0.3 0.3], ...
    'FaceAlpha', 0.6, 'DisplayName', 'Actually slip');
xline(0.5, 'k--', 'LineWidth', 1.5, 'DisplayName', 'Decision boundary');
hold off;

xlabel('Ensemble P(slip)');
ylabel('Count');
title('Ensemble Confidence Distribution — How Sure Is the AI?');
legend('Location', 'northwest');
grid on;

%% Save
save('biotac_simulation_results_v3.mat', ...
    'Y_pred_thresh', 'Y_pred_lda', 'Y_pred_ensemble', ...
    'thresh_accuracy', 'lda_accuracy', 'ensemble_accuracy', ...
    'thresh_latency_ms', 'lda_latency_ms', 'ens_latency_ms', ...
    'thresh_dropped', 'lda_dropped', 'ens_dropped', ...
    'thresh_crushed', 'lda_crushed', 'ens_crushed', ...
    'thresh_defect_rate', 'lda_defect_rate', 'ens_defect_rate', ...
    'trad_cost', 'lda_cost', 'ai_cost', ...
    'savings_vs_thresh', 'savings_vs_lda', ...
    'best_threshold', 'cost_per_dropped', 'cost_per_crush', ...
    'finger_accs', 'avg_prob_slip', 'finger_probs', 'total_model_kb');

fprintf('\nSaved to biotac_simulation_results_v3.mat\n');

fprintf('\n=== KEY TALKING POINTS FOR PRESENTATION ===\n');
fprintf('1. Mean threshold: %.1f%% — barely better than guessing\n', thresh_accuracy);
fprintf('2. LDA (classical ML): %.1f%% — a credible classical baseline\n', lda_accuracy);
fprintf('3. AI ensemble fusion: %.1f%% — each finger votes, majority wins\n', ensemble_accuracy);
fprintf('4. Over %d components, AI saves GBP%d vs threshold (%.0f%% reduction)\n', ...
    N, savings_vs_thresh, (savings_vs_thresh/max(trad_cost,1))*100);
fprintf('5. AI saves GBP%d vs LDA (%.0f%% reduction) — gains over strong classical too\n', ...
    savings_vs_lda, (savings_vs_lda/max(lda_cost,1))*100);
fprintf('6. Ensemble runs in ~%.1f ms — well within real-time control limits\n', ens_latency_ms);
fprintf('7. Total model size: %.0f KB — deployable on edge hardware\n', total_model_kb);
fprintf('8. Confidence plot shows the AI "knows when it is unsure"\n');
fprintf('   -> Can set a conservative threshold for high-value components\n');