import { Scene, PerspectiveCamera, WebGLRenderer, Light, ColorRepresentation, WebGLRendererParameters } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BoxHelper } from 'three'

interface PerspectiveCameraOptions {
  fov?: number
  near?: number
  far?: number
}

type LoaderEventName = 'onProgress' | 'onStart' | 'onError' | 'onLoad' | 'onLoading'

export function onGLTFLoad<T extends LoaderEventName>(
  evtName: T,
  fn: (...args: any[]) => void
): () => void

export class Viewer {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  controls: OrbitControls
  light: Light
  gltf: GLTF | null
  canvas: HTMLCanvasElement

  constructor(options?: {
    camera?: PerspectiveCameraOptions
    renderer?: WebGLRendererParameters
  })

  render(options?: { pixelRatio?: number }): Promise<void>
  setBgColor(color: ColorRepresentation, alpha: number): void
  autoRotate(speed: number): void
  enableCtrl(enabled: boolean): void
  setLight(options: { color?: ColorRepresentation; intensity?: number }): void
  dispose(): void

  loadGLTF(url: string, blobs?: Record<string, Blob>): Promise<GLTF>
  unloadGLTF(): boolean

  gltfAlignCenter(options?: { zoom?: number; alpha?: number }): boolean
  gltfWireFrame(wireframe: boolean): boolean
  gltfBoxHelper(color?: ColorRepresentation): BoxHelper & { dispose: () => void }
  mixer(): { timeScale: number } & { dispose?: () => void }
  gltfAnimate(names?: string[]): boolean
} 