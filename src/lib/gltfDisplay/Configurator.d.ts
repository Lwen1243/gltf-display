import { Viewer } from './Viewer'

interface ConfiguratorOptions {
  defaultConf?: boolean
  container?: Element
}

interface ConfiguratorConfig {
  bgColor?: string
  bgOpacity?: number
  enableCtrl?: boolean
  rotate?: number
  lightColor?: string
  lightIntensity?: number
  wireframe?: boolean
  boxHelper?: boolean
  zoom?: number
  alpha?: number
  animationSpeed?: number
  src?: string
  animations?: string[]
  model?: [string, Record<string, Blob>?]
}

export class Configurator {
  viewer: Viewer
  conf: ConfiguratorConfig

  constructor(options?: ConfiguratorOptions)
  
  watchConf(): void
  setConf(conf: Partial<ConfiguratorConfig>): void
} 