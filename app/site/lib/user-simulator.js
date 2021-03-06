import keyMap from "lib/key-map"
import isElementPartiallyInViewport from "site/lib/is-element-partially-in-viewport"
import smoothScroll from "smooth-scroll"

function createSequence(EmbedBox) {
  const targetLabels = EmbedBox.fetchedTargets.map(Target => Target.label.split(""))
  const toKeyDown = () => ({entity: keyMap.down, eventType: "keydown"})
  let sequence = []

  targetLabels.forEach(phrase => {
    const subSet = [...phrase, keyMap.backspace]

    sequence = sequence.concat(subSet.map(entity => ({entity, eventType: "input"})))
  })

  sequence = sequence.concat(
    targetLabels.map(toKeyDown), // Traverse targets
    toKeyDown(), // Back to start
    {entity: keyMap.enter, eventType: "keypress"} // Navigate
  )

  sequence.push({eventType: "scroll"})

  return sequence
}

let instance
let completionTimeout
let stepTimeout
let createInteractiveDemo

export function runDemo(iframe, onComplete = () => {}) {
  // Automated and user events may be subjected to race conditions between runs.
  clearTimeout(stepTimeout)
  clearTimeout(completionTimeout)

  const {EmbedBox} = iframe.contentWindow
  const sequence = createSequence(EmbedBox)
  const {PolyFilledCustomEvent} = window
  const defaults = {
    embedCode: `<script src='${PROJECT_URL}/examples/library.js'></script>`,
    targets: {
      drupal: {
        pluginURL: `${PROJECT_URL}/examples/drupal-plugin.zip`
      }
    },
    branding: false,
    scrollIntoView: false
  }
  const barrier = iframe.parentNode.querySelector(".barrier")
  const loadingDots = iframe.parentNode.querySelector(".loading-dots")
  let running = true

  if (createInteractiveDemo) barrier.removeEventListener("click", createInteractiveDemo)

  createInteractiveDemo = () => {
    clearTimeout(stepTimeout)
    clearTimeout(completionTimeout)
    running = false

    barrier.style.display = "none"

    if (instance) instance.destroy()

    const config = {...defaults,
      events: {
        onLoad() {
          loadingDots.setAttribute("data-state", "loaded")
        },
        visibilityChange(visible) {
          if (visible || this.destroyed) return

          loadingDots.setAttribute("data-state", "loading")
          setTimeout(createInteractiveDemo, 1500)
        }
      },
      scrollIntoView: true
    }

    loadingDots.setAttribute("data-state", "loading")
    requestAnimationFrame(() => instance = new EmbedBox(config))
  }

  let iframeDocument
  let searchComponent
  let input

  function simulate(index = 0) {
    if (!running) return
    if (instance && !instance.visible) return

    const {entity, eventType} = sequence[index]
    const meta = {}
    const lastIndex = sequence.length - 1
    let delay = 125

    if (!isElementPartiallyInViewport(iframe)) {
      createInteractiveDemo()
      return
    }

    function onStep() {
      if (index < lastIndex) {
        simulate(++index)
        return
      }

      completionTimeout = setTimeout(onComplete, 2000)
    }

    let runStep = () => {
      searchComponent.dispatchEvent(new PolyFilledCustomEvent(`dispatched-${eventType}`, meta))
      onStep()
    }

    // Prevent `tabindex` from focusing elements
    Array
      .from(instance.application.element.querySelectorAll("[tabindex]"))
      .forEach(element => element.removeAttribute("tabindex"))

    if (entity === keyMap.backspace) {
      input.value = ""
    }
    else if (["keypress", "keydown"].includes(eventType)) {
      meta.detail = {keyCode: entity}
      delay = 300
    }
    else if (eventType === "scroll") {
      const container = iframeDocument.querySelector("[data-component='target-wrapper'] .target-instructions")
      const bottom = container.scrollHeight - container.getBoundingClientRect().height

      const onScrolled = () => {
        if (running) onStep()
      }

      runStep = () => smoothScroll(container, bottom, {duration: 3000, onScrolled})
    }
    else {
      const next = sequence[index + 1]

      input.value += entity

      if (next && next.entity === keyMap.backspace) delay = 1100
    }

    stepTimeout = setTimeout(runStep, delay)
  }

  if (instance) instance.destroy()

  new EmbedBox({...defaults,
    events: {
      onLoad() {
        instance = this // eslint-disable-line consistent-this
        iframeDocument = instance.iframe.document
        searchComponent = iframeDocument.querySelector("[data-component='target-search']")
        input = searchComponent.querySelector(".search")

        // Prevent input events from scrolling Firefox.
        input.readOnly = true
        loadingDots.setAttribute("data-state", "loaded")

        barrier.addEventListener("click", createInteractiveDemo)

        if (!isElementPartiallyInViewport(iframe)) {
          createInteractiveDemo()
        }
        else {
          setTimeout(simulate, 1000)
        }
      }
    }
  })

  return createInteractiveDemo
}
