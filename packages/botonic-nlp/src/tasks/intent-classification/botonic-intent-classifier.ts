import { LayersModel, Tensor2D } from '@tensorflow/tfjs-node'
import { join } from 'path'

import { Dataset } from '../../dataset'
import {
  generateEmbeddingsMatrix,
  WordEmbeddingStorage,
} from '../../embeddings'
import { IndexedItems, LabelEncoder, OneHotEncoder } from '../../encode'
import { ModelEvaluation, ModelManager } from '../../model'
import { Preprocessor } from '../../preprocess'
import { ModelStorage } from '../../storage'
import { Locale } from '../../types'
import { unique } from '../../utils'
import { NlpTaskConfig } from '../nlp-task-config'
import {
  createSimpleNN,
  INTENT_CLASSIFIER_TEMPLATE,
  IntentClassifierParameters,
} from './models'
import { Intent, PredictionProcessor, Processor } from './process'
import { IntentClassificationConfigStorage } from './storage'

export interface IntentClassifierConfig extends NlpTaskConfig {
  intents: string[]
}

export class BotonicIntentClassifier {
  readonly locale: Locale
  readonly maxLength: number
  readonly vocabulary: string[]
  readonly intents: string[]
  private readonly processor: Processor
  private readonly predictionProcessor: PredictionProcessor
  private modelManager: ModelManager

  constructor(config: IntentClassifierConfig) {
    this.locale = config.locale
    this.maxLength = config.maxLength
    this.vocabulary = config.vocabulary
    this.intents = unique(config.intents)
    this.processor = new Processor(
      config.preprocessor,
      new LabelEncoder(new IndexedItems(this.vocabulary)),
      new OneHotEncoder(new IndexedItems(this.intents))
    )
    this.predictionProcessor = new PredictionProcessor(config.intents)
  }

  static async load(
    path: string,
    preprocessor: Preprocessor
  ): Promise<BotonicIntentClassifier> {
    const config = new IntentClassificationConfigStorage().load(path)
    const classifier = new BotonicIntentClassifier({
      locale: config.locale,
      maxLength: config.maxLength,
      vocabulary: config.vocabulary,
      intents: config.intents,
      preprocessor,
    })
    classifier.modelManager = new ModelManager(await ModelStorage.load(path))
    return classifier
  }

  // TODO: set embeddings as optional
  async createModel(
    template: INTENT_CLASSIFIER_TEMPLATE,
    storage: WordEmbeddingStorage,
    params?: IntentClassifierParameters
  ): Promise<LayersModel> {
    const embeddingsMatrix = await generateEmbeddingsMatrix(
      storage,
      this.vocabulary
    )

    switch (template) {
      case INTENT_CLASSIFIER_TEMPLATE.SIMPLE_NN:
        return createSimpleNN(
          this.maxLength,
          this.intents.length,
          embeddingsMatrix,
          params
        )
      default:
        throw new Error(`"${template}" is an invalid model template.`)
    }
  }

  setModel(model: LayersModel): void {
    this.modelManager = new ModelManager(model)
  }

  async train(
    dataset: Dataset,
    epochs: number,
    batchSize: number
  ): Promise<void> {
    const { x, y } = this.processor.processSamples(dataset.samples)
    await this.modelManager.train(x, y, { epochs, batchSize })
  }

  async evaluate(dataset: Dataset): Promise<ModelEvaluation> {
    const { x, y } = this.processor.processSamples(dataset.samples)
    return await this.modelManager.evaluate(x, y)
  }

  classify(text: string): Intent[] {
    const input = this.processor.processTexts([text])
    const prediction = this.modelManager.predict(input) as Tensor2D
    const intents = this.predictionProcessor.process(prediction)
    return intents
  }

  async saveModel(path: string): Promise<void> {
    path = join(path, this.locale)
    const config = {
      locale: this.locale,
      maxLength: this.maxLength,
      vocabulary: this.vocabulary,
      intents: this.intents,
    }
    new IntentClassificationConfigStorage().save(path, config)
    await this.modelManager.save(path)
  }
}
