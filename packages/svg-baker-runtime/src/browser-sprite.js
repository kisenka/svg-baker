import merge from 'deepmerge';
import Emitter from 'mitt';
import Sprite from './sprite';
import defaultConfig from './browser-sprite.config';
import {
  parse,
  moveGradientsOutsideSymbol,
  browserDetector as browser,
  getUrlWithoutFragment,
  updateUrls,
  locationChangeAngularEmitter
} from './utils';

/**
 * Internal emitter events
 * @enum
 * @private
 */
const Events = {
  RENDER: 'render',
  MOUNT: 'mount'
};

export default class BrowserSprite extends Sprite {
  constructor(cfg = {}) {
    super(merge(defaultConfig, cfg));

    const emitter = Emitter();
    this._emitter = emitter;
    this.node = false;
    this.isMounted = false;

    const { config } = this;

    if (config.autoConfigure) {
      this._autoConfigure(cfg);
    }

    if (config.syncUrlsWithBaseTag) {
      const baseUrl = document.getElementsByTagName('base')[0].getAttribute('href');
      emitter.on(Events.MOUNT, () => this.updateUrls('#', baseUrl));
    }

    const handleLocationChange = this._handleLocationChange.bind(this);
    this._handleLocationChange = handleLocationChange;

    // Provide way to update sprite urls externally via dispatching custom window event
    if (config.listenLocationChangeEvent) {
      window.addEventListener(config.locationChangeEvent, handleLocationChange);
    }

    // Emit location change event in Angular automatically
    if (config.locationChangeAngularEmitter) {
      locationChangeAngularEmitter(config.locationChangeEvent);
    }

    if (config.moveGradientsOutsideSymbol) {
      emitter.on(Events.RENDER, (node) => {
        moveGradientsOutsideSymbol(node);
      });
    }
  }

  /**
   * Automatically configure following options
   * - `syncUrlsWithBaseTag`
   * - `locationChangeAngularEmitter`
   * - `moveGradientsOutsideSymbol`
   * @param {Object} cfg
   * @private
   */
  _autoConfigure(cfg) {
    const { config } = this;

    if (typeof cfg.syncUrlsWithBaseTag === 'undefined') {
      config.syncUrlsWithBaseTag = typeof document.getElementsByTagName('base')[0] !== 'undefined';
    }

    if (typeof cfg.locationChangeAngularEmitter === 'undefined') {
      config.locationChangeAngularEmitter = 'angular' in window;
    }

    if (typeof cfg.moveGradientsOutsideSymbol === 'undefined') {
      config.moveGradientsOutsideSymbol = browser.isFirefox;
    }
  }

  /**
   * @param {Event} event
   * @param {Object} event.detail
   * @param {string} event.oldUrl
   * @param {string} event.newUrl
   * @private
   */
  _handleLocationChange(event) {
    const { oldUrl, newUrl } = event.detail;
    this.updateUrls(oldUrl, newUrl);
  }

  /**
   * Update URLs in sprite and usage elements
   * @param {string} oldUrl
   * @param {string} newUrl
   */
  updateUrls(oldUrl, newUrl) {
    if (!this.isMounted) {
      throw new Error('Sprite should be mounted to apply updateUrls');
    }

    const usages = document.querySelectorAll(this.config.usagesToUpdate);

    updateUrls(
      this.node,
      usages,
      `${getUrlWithoutFragment(oldUrl)}#`,
      `${getUrlWithoutFragment(newUrl)}#`
    );
  }

  /**
   * @return {Element}
   * @fires Events#RENDER
   */
  render() {
    const node = parse(this.stringify());
    this._emitter.emit(Events.RENDER, node);
    return node;
  }

  /**
   * @param {Element|string} [target]
   * @param {boolean} [prepend=false]
   * @return {Element} rendered sprite element
   * @fires Events#MOUNT
   */
  mount(target, prepend = false) {
    if (this.isMounted) {
      return this.node;
    }

    const mountTarget = target || this.config.mountTo;
    const parent = typeof mountTarget === 'string' ? document.querySelector(mountTarget) : mountTarget;
    const node = this.render();

    if (prepend && parent.childNodes[0]) {
      parent.insertBefore(node, parent.childNodes[0]);
    } else {
      parent.appendChild(node);
    }

    this.node = node;
    this.isMounted = true;

    this._emitter.emit(Events.MOUNT, node);

    return node;
  }

  /**
   * Detach sprite from the DOM
   */
  unmount() {
    this.node.parentNode.removeChild(this.node);
  }

  destroy() {
    const { config, symbols, _emitter } = this;

    symbols.forEach(s => s.destroy());

    _emitter.off('*');
    window.removeEventListener(config.locationChangeEvent, this._handleLocationChange);

    if (this.isMounted) {
      this.unmount();
    }
  }
}
