import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  LoadingManager,
  REVISION,
  Box3,
  Vector3,
  BoxHelper,
  AnimationMixer,
  Light,
  ColorRepresentation,
  WebGLRendererParameters,
  Material
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

interface PerspectiveCameraOptions {
  fov?: number
  near?: number
  far?: number
}

interface ViewerOptions {
  camera?: PerspectiveCameraOptions
  renderer?: WebGLRendererParameters
}

interface GLTFState {
  zoom: number
  alpha: number
  wireframe: boolean
  boxHelper: BoxHelper | null
  mixer: (AnimationMixer & { dispose: () => void }) | null
  animations: string[] | null
  animTimeScale?: number
}

type LoaderEventName = 'onProgress' | 'onStart' | 'onError' | 'onLoad' | 'onLoading'
type LoaderEventHandler = (...args: any[]) => void
type LoaderEvents = Record<LoaderEventName, LoaderEventHandler[]>

const GLTF_LOADER = initGLTFLoader()

export const onGLTFLoad = (() => {
  const listeners: LoaderEvents = {
    'onProgress': [], 'onStart': [], 'onError': [], 'onLoad': [], 'onLoading': []
  }
  Object.keys(listeners).forEach((k) => {
    GLTF_LOADER[k as LoaderEventName] = (...e: any[]) => {
      listeners[k as LoaderEventName].forEach(c => c?.(...e))
    }
  })
  return <T extends LoaderEventName>(evtName: T, fn: LoaderEventHandler): () => void => {
    listeners[evtName].push(fn)
    return () => {
      const l = listeners[evtName]
      l.splice(l.indexOf(fn), 1)
    }
  }
})()

export class Viewer {
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  controls: OrbitControls
  light: Light
  gltf: GLTF | null = null
  canvas: HTMLCanvasElement
  private _gltfState: GLTFState = {
    zoom: 0.5,
    alpha: 0.2,
    wireframe: false,
    boxHelper: null,
    mixer: null,
    animations: null,
    animTimeScale: undefined,
  }

  constructor({ camera: { fov, near, far } = {}, renderer = {} }: ViewerOptions = {}) {
    this.scene = new Scene()
    this.camera = new PerspectiveCamera(fov ?? 75, 2, near ?? 0.1, far ?? 10000)
    this.renderer = new WebGLRenderer({ ...renderer, antialias: true, alpha: true })
    this.canvas = this.renderer.domElement
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.addEventListener('change', this.render.bind(this))
    window.addEventListener('resize', this.render.bind(this))
    this.light = new AmbientLight()
    this.scene.add(this.light)
    GLTF_LOADER.ktx2LoaderDetectSupport(this.renderer)
  }

  render = rafDebounce(({ delta }: { delta: number }, { pixelRatio }: { pixelRatio?: number } = {}) => {
    this._resizeToDisplaySize(pixelRatio)
    this.controls.update()
    this._gltfState.mixer?.update(delta / 1000)
    this.renderer.render(this.scene, this.camera)
  })

  private _resizeToDisplaySize(pixelRatio?: number): boolean {
    const { width, clientWidth, height, clientHeight } = this.canvas
    pixelRatio ??= window.devicePixelRatio
    const newW = Math.ceil(clientWidth * pixelRatio)
    const newH = Math.ceil(clientHeight * pixelRatio)
    const needResize = newW !== width || newH !== height
    if (needResize) {
      this.renderer.setSize(newW, newH, false)
      this.camera.aspect = newW / newH
      this.camera.updateProjectionMatrix()
    }
    return needResize
  }

  setBgColor(color: ColorRepresentation, alpha: number): void {
    this.renderer.setClearColor(color, alpha)
    this.render()
  }

  autoRotate(speed: number): void {
    this.controls.autoRotate = !!speed
    this.controls.autoRotateSpeed = speed
    this.render()
  }

  enableCtrl(enabled: boolean): void {
    this.controls.enabled = enabled
    this.render()
  }

  setLight({ color, intensity }: { color?: ColorRepresentation; intensity?: number } = {}): void {
    if (color != null) this.light.color.set(color)
    if (intensity != null) this.light.intensity = intensity
    this.render()
  }

  dispose(): void {
    this.controls.dispose()
    this.light.dispose()
    this.renderer.dispose()
    const { boxHelper } = this._gltfState
    boxHelper?.dispose()
    this.mixer().dispose?.()
    if (this.gltf) {
      this.scene.remove(this.gltf.scene)
    }
    this.canvas.remove()
  }

  async loadGLTF(url: string, blobs?: Record<string, Blob>): Promise<GLTF> {
    this.unloadGLTF()
    this.gltf = await GLTF_LOADER.load(url, blobs)
    this.scene.add(this.gltf.scene)

    this.gltfAlignCenter()
    const { wireframe, boxHelper } = this._gltfState
    wireframe && this.gltfWireFrame(wireframe)
    boxHelper?.setFromObject(this.gltf.scene)
    this.gltfAnimate()

    this.render()
    return this.gltf
  }

  unloadGLTF(): boolean {
    this.mixer().dispose?.()
    if (this.gltf) {
      this.scene.remove(this.gltf.scene)
      this.gltf = null
      this.render()
      return true
    }
    return false
  }

  gltfAlignCenter({ zoom, alpha }: { zoom?: number; alpha?: number } = {}): boolean {
    const { _gltfState } = this
    if (zoom != null) _gltfState.zoom = zoom
    if (alpha != null) _gltfState.alpha = alpha
    const { zoom: _zoom, alpha: _alpha } = _gltfState
    if (!this.gltf) return false

    const model = this.gltf.scene
    model.updateMatrixWorld()
    const box = new Box3().setFromObject(model)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3()).length()

    this.controls.maxDistance = size * 10
    this.controls.minDistance = size / 100
    this.camera.near = size / 100
    this.camera.far = size * 100
    this.camera.position.copy(center)
    this.camera.position.x += size * (zoom ?? _zoom)
    this.camera.position.y += size * (alpha ?? _alpha)
    this.camera.position.z += size * (zoom ?? _zoom)
    this.camera.updateProjectionMatrix()
    this.controls.target = center
    this.render()
    return true
  }

  gltfWireFrame(wireframe: boolean): boolean {
    this._gltfState.wireframe = wireframe
    if (!this.gltf) return false

    const model = this.gltf.scene
    model.traverse((node: any) => {
      if (!node.geometry) return
      const materials = Array.isArray(node.material) ? node.material : [node.material]
      materials.forEach((material: Material) => {
        material.wireframe = wireframe
      })
    })
    this.render()
    return true
  }

  gltfBoxHelper(color?: ColorRepresentation): BoxHelper & { dispose: () => void } {
    const { boxHelper } = this._gltfState
    if (color == null && boxHelper) return boxHelper

    if (!this.gltf) {
      throw new Error('No GLTF model loaded')
    }

    const box = new BoxHelper(this.gltf.scene, color)
    this._gltfState.boxHelper = box
    this.scene.add(box)
    const dispose = box.dispose.bind(box)
    this.render()
    return Object.assign(box, {
      dispose: () => {
        this.scene.remove(box)
        dispose()
        this._gltfState.boxHelper = null
        this.render()
      }
    })
  }

  mixer(): { timeScale: number } & { dispose?: () => void } {
    const { mixer, animTimeScale } = this._gltfState
    if (mixer) return mixer

    const nullRst = Object.defineProperties({ timeScale: animTimeScale }, {
      timeScale: {
        set: (v: number) => {
          this._gltfState.animTimeScale = v
          return v
        }
      }
    })

    if (!this.gltf) return nullRst

    const { animations, scene } = this.gltf
    if (!animations?.length) return nullRst

    const mMixer = new AnimationMixer(scene)
    this._gltfState.mixer = mMixer as any
    if (animTimeScale != null) {
      mMixer.timeScale = animTimeScale
    }

    const timer = setInterval(this.render.bind(this))
    return Object.assign(mMixer, {
      dispose: () => {
        clearInterval(timer)
        mMixer.stopAllAction()
        this._gltfState.animations = null
        mMixer.uncacheRoot(mMixer.getRoot())
        this._gltfState.mixer = null
        this._gltfState.animTimeScale = undefined
      }
    })
  }

  gltfAnimate(names?: string[]): boolean {
    const animationsMap: Record<string, boolean> = {}
    
    if (names) {
      this._gltfState.animations?.forEach(e => {
        animationsMap[e] = false
      })
      this._gltfState.animations = [...names]
    } else {
      names = this._gltfState.animations ?? []
    }

    if (!this.gltf || !names.length) return false

    names.forEach(e => {
      animationsMap[e] = true
    })

    const { animations } = this.gltf
    for (const clip of animations) {
      if (animationsMap[clip.name]) {
        const action = this.mixer().clipAction?.(clip)
        action?.reset().play()
      }
      if (animationsMap[clip.name] === false) {
        this.mixer().uncacheAction?.(clip)
      }
    }
    return true
  }
}

interface GLTFLoaderOptions {
  renderer?: WebGLRenderer
  threePath?: string
}

function initGLTFLoader({
  renderer,
  threePath = `https://unpkg.com/three@0.${REVISION}.x`
}: GLTFLoaderOptions = {}) {
  const manager = new LoadingManager()
  const dracoLoader = new DRACOLoader(manager).setDecoderPath(
    `${threePath}/examples/jsm/libs/draco/gltf/`,
  )
  const ktx2Loader = new KTX2Loader(manager).setTranscoderPath(
    `${threePath}/examples/jsm/libs/basis/`,
  )

  function ktx2LoaderDetectSupport(renderer: WebGLRenderer) {
    ktx2Loader.detectSupport(renderer)
  }
  renderer && ktx2LoaderDetectSupport(renderer)

  const loader = new GLTFLoader(manager)
    .setCrossOrigin('anonymous')
    .setDRACOLoader(dracoLoader)
    .setKTX2Loader(ktx2Loader)
    .setMeshoptDecoder(MeshoptDecoder)

  function onLoading(evt: ProgressEvent) {}
  const mm = Object.assign(manager, { onLoading })

  return Object.assign(mm, {
    ktx2LoaderDetectSupport,
    load(gltfUrl: string, blobs?: Record<string, Blob>): Promise<GLTF> {
      const objectURLs: string[] = []
      manager.setURLModifier((url) => {
        const blob = blobs?.[url]
        if (blob) {
          url = URL.createObjectURL(blob)
        }
        objectURLs.push(url)
        return url
      })
      const cleanup = () => objectURLs.forEach((url) => URL.revokeObjectURL(url))

      return new Promise((resolve, reject) => {
        loader.load(gltfUrl, 
          (data) => {
            resolve(data)
            cleanup()
          },
          (e) => mm.onLoading?.(e),
          (err) => {
            reject(err)
            cleanup()
          }
        )
      })
    }
  })
}

function rafDebounce<T extends any[], R>(
  cb: (t: { time: number; delta: number }, ...args: T) => R
): (...args: T) => Promise<R> {
  let pending: Promise<R> | undefined
  let prevTime = 0
  return function (this: any, ...args: T) {
    if (pending) return pending
    return (pending = new Promise((resolve) =>
      requestAnimationFrame((time) => {
        pending = undefined
        const delta = time - prevTime
        resolve(
          cb.call(this, { time, delta }, ...args)
        )
        prevTime = time
      })
    ))
  }
} 