import BaseComponent from "components/base-component"
import {getStore} from "lib/store"

export default class BasePage extends BaseComponent {
  static extend = function extend({fallback, id, label, template, templateVars} = {}) {
    if (!id) throw new Error("UniversalEmbed: Page must have `id`")
    if (!label) throw new Error("UniversalEmbed: Page must have `label`")

    return class CustomPage extends BasePage {
      static fallback = fallback || false;
      static id = id;
      static label = label;
      static template = template || "";
      static templateVars = templateVars || {}
    }
  };

  compileTemplate() {
    const {id, templateVars} = this.constructor
    const downloadURL = getStore().downloadURLs[this.constructor.id]

    BaseComponent.prototype.compileTemplate.call(this, {downloadURL, ...templateVars})

    this.element.setAttribute("data-component", `${id}-page`)
    this.element.setAttribute("data-column", "")
    this.element.setAttribute("autofocus", "")
    this.element.className = `markdown instructions ${this.element.className || ""}`

    return this.element
  }
}