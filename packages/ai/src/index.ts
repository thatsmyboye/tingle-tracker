export { getAnthropicClient, CLAUDE_MODEL } from "./client";
export {
  buildTriggerClassificationPrompt,
  buildContentNarrativePrompt,
  type TriggerClassificationInput,
  type ContentNarrativeInput,
} from "./prompts/trigger-classification";
export {
  buildAudioHeatmapPredictionPrompt,
  type AudioHeatmapPredictionInput,
} from "./prompts/audio-heatmap-prediction";
