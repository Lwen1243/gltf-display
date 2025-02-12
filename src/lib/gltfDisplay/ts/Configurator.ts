import { Viewer } from './js/Viewer'

interface ConfiguratorConfig {
  bgColor: string
  bgOpacity: number
  enableCtrl: boolean
  rotate: number
  lightColor: string
  lightIntensity: number
  wireframe: boolean
  boxHelper: boolean
  zoom: number
  alpha: number
  animationSpeed: number
  src?: string
  animations?: string[]
  model?: [string, Record<string, Blob>?]
}

interface ConfiguratorOptions {
  defaultConf?: boolean
  container?: Element
}

export class Configurator {
  viewer: Viewer
  private _conf: ConfiguratorConfig = {
    bgColor: '#ffffff',
    bgOpacity: 1,
    enableCtrl: true,
    rotate: 0,
    lightColor: '#ffffff',
    lightIntensity: 1,
    wireframe: false,
    boxHelper: false,
    zoom: 0.5,
    alpha: 0.2,
    animationSpeed: 1
  }
  conf: Partial<ConfiguratorConfig> = {}

  constructor({ defaultConf, container }: ConfiguratorOptions = {}) {
    const canvas = document.createElement('canvas')
    this.viewer = new Viewer({ renderer: { canvas } })
    {
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
    }
    ;(container ?? document.body).appendChild(canvas)
    if (defaultConf) {
      this.conf = this._conf
    }
    this.watchConf()
  }

  watchConf() {
    const { viewer, conf } = this
    const p = {
      bgColor(v: string) {
        viewer.setBgColor(v, conf.bgOpacity!)
      },
      bgOpacity(v: number) {
        viewer.setBgColor(conf.bgColor!, v)
      },
      enableCtrl: viewer.enableCtrl.bind(viewer),
      rotate: viewer.autoRotate.bind(viewer),
      lightColor(color: string) {
        viewer.setLight({ color })
      },
      lightIntensity(intensity: number) {
        viewer.setLight({ intensity })
      },
      src(url: string) {
        viewer.loadGLTF(url)
      },
      model([url, blobs]: [string, Record<string, Blob>?] = []) {
        viewer.loadGLTF(url, blobs)
      },
      wireframe(v: boolean) {
        viewer.gltfWireFrame(v)
      },
      boxHelper(v: boolean) {
        v ? viewer.gltfBoxHelper() : viewer.gltfBoxHelper().dispose()
      },
      zoom: (v: number) => viewer.gltfAlignCenter({ zoom: v }),
      alpha: (v: number) => viewer.gltfAlignCenter({ alpha: v }),
      animations: (v: string[]) => {
        viewer.gltfAnimate(v)
      },
      animationSpeed(v: number) {
        viewer.mixer().timeScale = v
      }
    }

    type WatchSetFn<T> = (fn: (v: T) => any, _v: T) => {
      set(v: T): T
      get(): T
    }

    const watchSetFn: WatchSetFn<any> = (fn, _v) => {
      return {
        set(v) {
          if (fn.call(this, v) === false) {
            return _v
          }
          return (_v = v)
        },
        get() {
          return _v
        }
      }
    }

    const propertiesF = Object.fromEntries(
      Object.entries(p).map(([k, v]) => [k, watchSetFn(v, conf[k as keyof ConfiguratorConfig])])
    )
    Object.defineProperties(conf, propertiesF)
  }

  setConf(conf: Partial<ConfiguratorConfig>) {
    Object.assign(this.conf, conf)
  }
} 