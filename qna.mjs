/**
 * @file Text Generation with Hugging Face Transformers.js.
 *
 * @description
 * This script demonstrates how to perform a question-answering task by using a
 * text-generation model from the Hugging Face Transformers.js library. It leverages
 * the high-level `pipeline` abstraction to easily load a pre-trained model from
 * the Hugging Face Hub and generate text based on a formatted prompt.
 *
 * This approach is very flexible, allowing you to easily swap out different
 * models from the Hub to experiment with performance and accuracy.
 *
 * @requires @huggingface/transformers
 *
 * To run this script:
 * 1. Make sure you have a package.json file (run `npm init -y`).
 * 2. Add "type": "module" to your package.json file.
 * 3. Install the required package:
 * npm install @huggingface/transformers
 * 4. Run the script:
 * node your_script_name.js
 */

//================================================================================
// Section 1: Imports
//================================================================================

// Import the `pipeline` function from the Hugging Face Transformers library.
// The pipeline is the easiest way to use a pre-trained model for a specific task.
import { pipeline } from '@huggingface/transformers';

//================================================================================
// Section 2: Main Execution Block
//================================================================================

async function main() {
  console.log('--- Text Generation with Hugging Face Transformers.js ---');

  try {
    // --- 2.1: Define Context and Question ---
    const context =
      'Operation Starfall involved the deployment of satellite surveillance assets over the ' +
      'Eastern sector, tracking anomalous energy signatures. The findings, detailed in ' +
      'Appendix B, reveal capabilities exceeding known terrestrial technologies. Access to ' +
      'this information is restricted to personnel with Level 5 clearance. Unauthorized ' +
      'disclosure will result in immediate termination and prosecution under national security statutes.';

    const question = 'Based on the text, what is the classification level of this document (e.g., Public, Secret, Top Secret)?';

    // --- 2.2: Format the Prompt for the Text Generation Model ---
    const prompt = `CONTEXT:\n${context}\n\nQUESTION:\n${question}\n\nANSWER:`;

    console.log('\n--- Model Input ---');
    console.log(prompt);
    console.log('-------------------');


    // --- 2.3: Create the Text Generation Pipeline ---
    // We specify the task ('text-generation') and the model to use.
    console.log('\nLoading the text-generation model...');
    const startTime = process.hrtime.bigint();
    /**
     * Note: The 'bf16' dtype (bfloat16) is specified for model loading.
     * This data type is typically used for performance gains on specific hardware,
     * such as newer NVIDIA GPUs (Ampere architecture and later) or Google TPUs.
     * It may not be supported or provide benefits on all CPU environments.
     */
    const generator = await pipeline(
      "text-generation",
      "onnx-community/Qwen3-0.6B-ONNX",
      { dtype: "int8" },
    );
    const loadTime = Number(process.hrtime.bigint() - startTime) / 1e9;
    console.log(`Model loaded successfully in ${loadTime.toFixed(2)}s.`);

    // --- 2.4: Generate the Answer ---
    // We call the pipeline with our prompt. We can also provide parameters
    // like max_new_tokens to control the length of the generated answer.
    console.log('\nGenerating answer...');
    const inferenceStartTime = process.hrtime.bigint();
    const outputs = await generator(prompt, {
      max_new_tokens: 128, // Limit the length of the generated answer
      num_return_sequences: 1,
      repetition_penalty: 1.2,
      eos_token_id: generator.tokenizer.eos_token_id,
    });
    const inferenceTime = Number(process.hrtime.bigint() - inferenceStartTime) / 1e9;
    console.log(`Inference completed in ${inferenceTime.toFixed(2)}s.`);

    // --- 2.5: Display the Results ---
    console.log('\n--- Results ---');
    if (outputs && outputs.length > 0 && outputs[0].generated_text) {
      // The output includes the original prompt, so we need to extract just the new text.
      const generatedText = outputs[0].generated_text;
      const answer = generatedText.substring(prompt.length).trim();
      console.log(`Generated Answer: "${answer}"`);
    } else {
      console.log('Could not generate an answer.');
      console.log('Full output:', outputs);
    }
    console.log('---------------');

  } catch (error) {
    console.error('\n--- An error occurred ---');
    console.error(error);
    process.exit(1);
  }
}

// Start the application
main();
