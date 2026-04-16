export { getAnthropicClient, CLAUDE_MODEL } from "./client";
export {
  buildTriggerClassificationPrompt,
  type TriggerClassificationInput,
} from "./prompts/trigger-classification";
export {
  buildAudioHeatmapPredictionPrompt,
  type AudioHeatmapPredictionInput,
} from "./prompts/audio-heatmap-prediction";
