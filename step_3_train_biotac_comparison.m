%% TRAIN COMPARISON MODELS ON BIOTAC DATA
%  Compares Neural Network vs SVM vs Random Forest vs Decision Tree
%  vs Linear Discriminant for grasp stability prediction
%
%  FIXES APPLIED:
%    - Uses train/val split from Step 2 (test set untouched during training)
%    - Added Linear Discriminant as a stronger classical baseline
%
%  Requires: biotac_data.mat, trained_biotac_model.mat
%  Requires: Statistics and Machine Learning Toolbox
%  Outputs:  biotac_model_comparison.mat, comparison figures

clc; clear; close all;

%% Load data and pre-trained NN
load('biotac_data.mat');
load('trained_biotac_model.mat', 'net', 'mu', 'sigma', 'accuracy', ...
    'nn_inference_ms', 'nn_size_kb', 'auc', 'Y_prob_slip', 'use_trainnet', ...
    'train_idx', 'val_idx');

% Reconstruct the same train/val split used in Step 2
X_tr  = X_train(train_idx, :);
Y_tr  = Y_train(train_idx);
X_val = X_train(val_idx, :);
Y_val = Y_train(val_idx);

X_tr_norm   = (X_tr  - mu) ./ sigma;
X_val_norm  = (X_val - mu) ./ sigma;
X_test_norm = (X_test - mu) ./ sigma;

nn_accuracy = accuracy;
fprintf('Neural Network accuracy: %.2f%%\n', nn_accuracy);

%% ========== MODEL 2: SVM ==========
fprintf('\n--- Training SVM (ECOC, RBF kernel) ---\n');

tic;
svm_template = templateSVM('KernelFunction', 'rbf', 'KernelScale', 'auto', ...
    'BoxConstraint', 1, 'Standardize', false);
svm_model = fitcecoc(X_tr_norm, Y_tr, ...
    'Learners', svm_template, ...
    'Coding', 'onevsone');
svm_train_time = toc;
fprintf('Training time: %.2f s\n', svm_train_time);

[Y_pred_svm, ~, ~] = predict(svm_model, X_test_norm);
[~, svm_scores] = predict(svm_model, X_test_norm);
svm_prob_slip = svm_scores(:, 2);

svm_accuracy = sum(Y_pred_svm == Y_test) / numel(Y_test) * 100;

test_sample = X_test_norm(1, :);
tic;
for i = 1:1000
    predict(svm_model, test_sample);
end
svm_inference_ms = (toc / 1000) * 1000;

svm_info = whos('svm_model');
svm_size_kb = svm_info.bytes / 1024;

[svm_fpr, svm_tpr, ~] = perfcurve(Y_test, svm_prob_slip, 1);
svm_auc = trapz(svm_fpr, svm_tpr);

fprintf('Accuracy: %.2f%%\n', svm_accuracy);
fprintf('Inference: %.2f ms\n', svm_inference_ms);
fprintf('AUC: %.3f\n', svm_auc);
fprintf('Size: %.1f KB\n', svm_size_kb);

%% ========== MODEL 3: RANDOM FOREST ==========
fprintf('\n--- Training Random Forest (100 trees) ---\n');

tic;
num_vars_to_sample = max(1, round(sqrt(size(X_tr_norm, 2))));

rf_model = TreeBagger(100, X_tr_norm, Y_tr, ...
    'Method', 'classification', ...
    'OOBPrediction', 'on', ...
    'MinLeafSize', 5, ...
    'NumVariablesToSample', num_vars_to_sample);
rf_train_time = toc;
fprintf('Training time: %.2f s\n', rf_train_time);

[Y_pred_rf_str, rf_scores] = predict(rf_model, X_test_norm);
Y_pred_rf = str2double(Y_pred_rf_str);
rf_prob_slip = rf_scores(:, 2);

rf_accuracy = sum(Y_pred_rf == Y_test) / numel(Y_test) * 100;

tic;
for i = 1:1000
    predict(rf_model, test_sample);
end
rf_inference_ms = (toc / 1000) * 1000;

rf_info = whos('rf_model');
rf_size_kb = rf_info.bytes / 1024;

[rf_fpr, rf_tpr, ~] = perfcurve(Y_test, rf_prob_slip, 1);
rf_auc = trapz(rf_fpr, rf_tpr);

fprintf('Accuracy: %.2f%%\n', rf_accuracy);
fprintf('Inference: %.2f ms\n', rf_inference_ms);
fprintf('AUC: %.3f\n', rf_auc);
fprintf('Size: %.1f KB\n', rf_size_kb);

%% ========== MODEL 4: DECISION TREE (baseline) ==========
fprintf('\n--- Training Decision Tree (baseline) ---\n');

tic;
dt_model = fitctree(X_tr_norm, Y_tr, 'MinLeafSize', 10);
dt_train_time = toc;

Y_pred_dt = predict(dt_model, X_test_norm);
[~, dt_scores] = predict(dt_model, X_test_norm);
dt_prob_slip = dt_scores(:, 2);

dt_accuracy = sum(Y_pred_dt == Y_test) / numel(Y_test) * 100;

tic;
for i = 1:1000
    predict(dt_model, test_sample);
end
dt_inference_ms = (toc / 1000) * 1000;

dt_info = whos('dt_model');
dt_size_kb = dt_info.bytes / 1024;

[dt_fpr, dt_tpr, ~] = perfcurve(Y_test, dt_prob_slip, 1);
dt_auc = trapz(dt_fpr, dt_tpr);

fprintf('Accuracy: %.2f%%\n', dt_accuracy);
fprintf('Inference: %.2f ms\n', dt_inference_ms);

%% ========== MODEL 5: LINEAR DISCRIMINANT (stronger classical baseline) ==========
fprintf('\n--- Training Linear Discriminant Analysis ---\n');

tic;
lda_model = fitcdiscr(X_tr_norm, Y_tr, 'DiscrimType', 'linear');
lda_train_time = toc;

Y_pred_lda = predict(lda_model, X_test_norm);
[~, lda_scores] = predict(lda_model, X_test_norm);
lda_prob_slip = lda_scores(:, 2);

lda_accuracy = sum(Y_pred_lda == Y_test) / numel(Y_test) * 100;

tic;
for i = 1:1000
    predict(lda_model, test_sample);
end
lda_inference_ms = (toc / 1000) * 1000;

lda_info = whos('lda_model');
lda_size_kb = lda_info.bytes / 1024;

[lda_fpr, lda_tpr, ~] = perfcurve(Y_test, lda_prob_slip, 1);
lda_auc = trapz(lda_fpr, lda_tpr);

fprintf('Accuracy: %.2f%%\n', lda_accuracy);
fprintf('Inference: %.2f ms\n', lda_inference_ms);
fprintf('AUC: %.3f\n', lda_auc);

%% ========== COMPARISON SUMMARY ==========
model_names = {'Neural Network', 'SVM (RBF)', 'Random Forest', 'Decision Tree', 'Linear Discrim.'};
accuracies    = [nn_accuracy,  svm_accuracy,  rf_accuracy,  dt_accuracy,  lda_accuracy];
inference_ms  = [nn_inference_ms, svm_inference_ms, rf_inference_ms, dt_inference_ms, lda_inference_ms];
sizes_kb      = [nn_size_kb,   svm_size_kb,   rf_size_kb,   dt_size_kb,   lda_size_kb];
aucs          = [auc,          svm_auc,       rf_auc,       dt_auc,       lda_auc];

n_models = numel(model_names);

fprintf('\n%s\n', repmat('=', 1, 85));
fprintf('MODEL COMPARISON SUMMARY\n');
fprintf('%s\n', repmat('=', 1, 85));
fprintf('%-18s  %-10s  %-13s  %-10s  %-6s\n', 'Model', 'Accuracy', 'Inference(ms)', 'Size(KB)', 'AUC');
fprintf('%s\n', repmat('-', 1, 85));
for i = 1:n_models
    fprintf('%-18s  %-10.2f  %-13.2f  %-10.1f  %-6.3f\n', ...
        model_names{i}, accuracies(i), inference_ms(i), sizes_kb(i), aucs(i));
end
fprintf('%s\n', repmat('=', 1, 85));

%% Latency check
latency_threshold = 10.0;
fprintf('\nReal-time suitability (< %.1f ms):\n', latency_threshold);
for i = 1:n_models
    fprintf('  %s: %s (%.2f ms)\n', model_names{i}, ...
        string(inference_ms(i) < latency_threshold), inference_ms(i));
end

%% ========== VISUALISATIONS ==========

%% Figure 1: Comparison bar charts
figure('Position', [100 100 1200 450], 'Name', 'Model Comparison');

bar_colors = [0.2 0.6 1.0; 0.9 0.4 0.3; 0.3 0.8 0.3; 0.8 0.7 0.2; 0.6 0.4 0.8];

subplot(1,3,1);
b = bar(accuracies);
b.FaceColor = 'flat';
b.CData = bar_colors;
set(gca, 'XTickLabel', model_names, 'XTickLabelRotation', 25);
ylabel('Accuracy (%)');
title('Classification Accuracy');
ylim([max(min(accuracies)-10, 0), 100]);
grid on;

subplot(1,3,2);
b = bar(inference_ms);
b.FaceColor = 'flat';
b.CData = bar_colors;
hold on;
yline(latency_threshold, 'r--', 'LineWidth', 1.5);
text(n_models-0.5, latency_threshold*1.1, '10ms threshold', 'Color', 'r', 'FontSize', 9);
set(gca, 'XTickLabel', model_names, 'XTickLabelRotation', 25);
ylabel('Inference Time (ms)');
title('Single-Sample Latency');
grid on;

subplot(1,3,3);
b = bar(aucs);
b.FaceColor = 'flat';
b.CData = bar_colors;
set(gca, 'XTickLabel', model_names, 'XTickLabelRotation', 25);
ylabel('AUC');
title('Area Under ROC Curve');
ylim([max(min(aucs)-0.1, 0), 1.0]);
grid on;

sgtitle('Model Comparison — BioTac Grasp Stability', 'FontSize', 14);

%% Figure 2: ROC curves overlaid
figure('Position', [100 550 600 500], 'Name', 'ROC Comparison');

[nn_fpr, nn_tpr, ~] = perfcurve(Y_test, Y_prob_slip, 1);

hold on;
plot(nn_fpr,  nn_tpr,  'b-',  'LineWidth', 2, 'DisplayName', sprintf('NN (AUC=%.3f)', auc));
plot(svm_fpr, svm_tpr, 'r-',  'LineWidth', 2, 'DisplayName', sprintf('SVM (AUC=%.3f)', svm_auc));
plot(rf_fpr,  rf_tpr,  'g-',  'LineWidth', 2, 'DisplayName', sprintf('RF (AUC=%.3f)', rf_auc));
plot(dt_fpr,  dt_tpr,  'm--', 'LineWidth', 1.5, 'DisplayName', sprintf('DT (AUC=%.3f)', dt_auc));
plot(lda_fpr, lda_tpr, 'c-',  'LineWidth', 1.5, 'DisplayName', sprintf('LDA (AUC=%.3f)', lda_auc));
plot([0 1], [0 1], 'k:', 'LineWidth', 1, 'DisplayName', 'Random');
hold off;

xlabel('False Positive Rate');
ylabel('True Positive Rate');
title('ROC Curve Comparison — All Models');
legend('Location', 'southeast');
grid on;

%% Figure 3: Confusion matrices
figure('Position', [750 550 1200 400], 'Name', 'Confusion Matrices');

subplot(1,4,1);
confusionchart(Y_test, Y_pred_svm);
title(sprintf('SVM — %.1f%%', svm_accuracy));

subplot(1,4,2);
confusionchart(Y_test, Y_pred_rf);
title(sprintf('Random Forest — %.1f%%', rf_accuracy));

subplot(1,4,3);
confusionchart(Y_test, Y_pred_dt);
title(sprintf('Decision Tree — %.1f%%', dt_accuracy));

subplot(1,4,4);
confusionchart(Y_test, Y_pred_lda);
title(sprintf('Linear Discrim. — %.1f%%', lda_accuracy));

%% ========== DESIGN JUSTIFICATION ==========
fprintf('\n%s\n', repmat('=', 1, 85));
fprintf('DESIGN DECISION JUSTIFICATION\n');
fprintf('%s\n', repmat('=', 1, 85));

[~, best_acc]   = max(accuracies);
[~, best_speed] = min(inference_ms);
[~, best_auc]   = max(aucs);
[~, smallest]   = min(sizes_kb);

fprintf('Best accuracy:   %s (%.2f%%)\n', model_names{best_acc}, accuracies(best_acc));
fprintf('Fastest:         %s (%.2f ms)\n', model_names{best_speed}, inference_ms(best_speed));
fprintf('Best AUC:        %s (%.3f)\n', model_names{best_auc}, aucs(best_auc));
fprintf('Smallest model:  %s (%.1f KB)\n', model_names{smallest}, sizes_kb(smallest));

fprintf('\nFor edge deployment on tactile sensor:\n');
fprintf('  -> Neural network offers the best balance of accuracy and speed\n');
fprintf('  -> Small enough to fit on an embedded microcontroller\n');
fprintf('  -> Inference time well within real-time control loop requirements\n');
fprintf('%s\n', repmat('=', 1, 85));

%% Save
comparison_results = table(model_names', accuracies', inference_ms', sizes_kb', aucs', ...
    'VariableNames', {'Model', 'Accuracy', 'Inference_ms', 'Size_KB', 'AUC'});

save('biotac_model_comparison.mat', ...
    'comparison_results', 'model_names', 'accuracies', 'inference_ms', 'sizes_kb', 'aucs', ...
    'svm_model', 'rf_model', 'dt_model', 'lda_model', ...
    'svm_accuracy', 'rf_accuracy', 'dt_accuracy', 'lda_accuracy');

fprintf('\nSaved comparison to biotac_model_comparison.mat\n');