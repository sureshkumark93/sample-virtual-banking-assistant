/*********************************************************************************************************************
*  Copyright 2025 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
*                                                                                                                    *
*  Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance        *
*  with the License. A copy of the License is located at                                                             *
*                                                                                                                    *
*      http://aws.amazon.com/asl/                                                                                    *
*                                                                                                                    *
*  or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES *
*  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
*  and limitations under the License.                                                                                *
**********************************************************************************************************************/

/**
 * Audio Processor Worklet
 * 
 * This AudioWorklet handles real-time audio processing for the Virtual Banking Assistant.
 * It manages a buffer of audio data and streams it to the audio output in a controlled manner.
 * 
 * Features:
 * - Buffered audio playback to prevent gaps
 * - Dynamic buffer management to prevent memory leaks
 * - Automatic request for more data when buffer runs low
 */

class AudioProcessor extends AudioWorkletProcessor {
    /**
     * Initialize the audio processor.
     * Sets up the audio buffer and message handling from the main thread.
     */
    constructor() {
        super();
        this.buffer = new Float32Array(0);  // Audio data buffer
        this.position = 0;  // Current playback position in buffer

        // Handle messages from main thread
        this.port.onmessage = (event) => {
            if (event.data.type === 'data') {
                // Append new audio data to buffer
                const newBuffer = new Float32Array(this.buffer.length + event.data.audio.length);
                newBuffer.set(this.buffer);
                newBuffer.set(event.data.audio, this.buffer.length);
                this.buffer = newBuffer;
            } else if (event.data.type === 'clear') {
                // Clear the buffer and reset position
                this.buffer = new Float32Array(0);
                this.position = 0;
            }
        };
    }

    /**
     * Process audio data.
     * Called by the audio system when it needs more audio data to play.
     * 
     * @param {Array} inputs - Array of input audio buffers (unused)
     * @param {Array} outputs - Array of output audio buffers to fill
     * @param {Object} parameters - Processing parameters (unused)
     * @returns {boolean} True to keep the processor running
     */
    process(inputs, outputs, parameters) {
        const output = outputs[0][0];  // Get first channel of first output

        // Check if we have enough data in buffer
        if (this.buffer.length - this.position < output.length) {
            // Request more data from main thread
            this.port.postMessage('needData');
            return true;
        }

        // Copy data from buffer to output
        for (let i = 0; i < output.length; i++) {
            output[i] = this.buffer[this.position + i];
        }

        this.position += output.length;

        // Clean up buffer if we've processed a significant amount
        // This prevents the buffer from growing indefinitely
        if (this.position > sampleRate * 2) {  // Clean up after 2 seconds of audio
            this.buffer = this.buffer.slice(this.position);
            this.position = 0;
        }

        return true;  // Keep processor alive
    }
}

// Register the processor with the audio worklet system
registerProcessor('audio-processor', AudioProcessor);
