# TactileSimulation
AI-Enhanced Slip Control Simulation in MATLAB.

This repository contains a MATLAB and Simulink framework for processing BioTac tactile sensor data, training machine learning classifiers for slip detection, and simulating control performance compared to traditional slip control methods. It utilizes the [BioTac SP Stability Set v2](https://github.com/3dperceptionlab/biotacsp-stability-set-v2) for slip analysis and modeling.

## File Structure

- `biotacsp-stability-set-v2/`: Cloned sub-directory containing the raw BioTac sensor dataset.
- `step_1_load_biotac_data.m`: Loads and preprocesses the BioTac sensor dataset.
- `step_2_train_biotac_classifier.m`: Trains the primary AI classifier for slip detection.
- `step_3_train_biotac_comparison.m`: Trains baseline or comparative models for evaluation.
- `step_4_retune_fused_model.m`: Retunes the fused AI-traditional control model based on training outputs.
- `step_5_traditional_vs_ai_simulation.m`: Executes the final simulation evaluating traditional control vs. the AI-enhanced approach.
- `build_biotac_simulink.m`: Constructs or configures the required Simulink environment and blocks for the physical simulation.

## Prerequisites

- MATLAB (Tested for data processing and model training)
- Simulink (For physics and control simulation)
- Required Toolboxes (recommended):
  - Statistics and Machine Learning Toolbox
  - Control System Toolbox
  - Simulink Control Design

## Instructions for Use

To reproduce the simulations and train the models, run the scripts sequentially from the MATLAB command window or editor:

1. **Data Preparation**
   The project includes the BioTac SP Stability Set v2 dataset. The data folder `biotacsp-stability-set-v2/` should already be present in this repository. 
   Run `step_1_load_biotac_data.m` to load and preprocess the dataset for training.

2. **Model Training**
   Run `step_2_train_biotac_classifier.m` to train the fundamental slip detector.
   *(Optional)* Run `step_3_train_biotac_comparison.m` if you are generating comparative evaluation metrics.

3. **Model Integration**
   Run `step_4_retune_fused_model.m` to integrate the trained models into the control architecture and adjust tuning parameters to ensure stability.

4. **Simulink Configuration**
   Run `build_biotac_simulink.m` to initialize the simulation environment and build the necessary Simulink structures.

5. **Simulation and Evaluation**
   Run `step_5_traditional_vs_ai_simulation.m` to perform the comparative simulation block. This will execute the control loop and output performance plots comparing the traditional slip limits against the AI-enhanced controller.
