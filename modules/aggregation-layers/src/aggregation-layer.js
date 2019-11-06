// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import {
  Layer,
  CompositeLayer,
  AttributeManager,
  _compareProps as compareProps
} from '@deck.gl/core';
import {cssToDeviceRatio} from '@luma.gl/core';
import {filterProps} from './utils/prop-utils';

export default class AggregationLayer extends CompositeLayer {
  initializeState(dimensions) {
    super.initializeState();

    // props , when changed doesn't require updating aggregation
    const ignoreProps = filterProps(this.constructor._propTypes, dimensions.data.props);

    this.setState({
      ignoreProps: Object.assign(ignoreProps, Layer.defaultProps),
      dimensions
    });
  }

  updateState(opts) {
    super.updateState(opts);
    const {changeFlags} = opts;
    if (changeFlags.extensionsChanged) {
      const shaders = this.getShaders({});
      if (shaders && shaders.defines) {
        shaders.defines.NON_INSTANCED_MODEL = 1;
      }
      this.updateShaders(shaders);
    }

    // Explictly call to update attributes as 'CompositeLayer' doesn't call this
    this._updateAttributes(opts.props);
  }

  updateAttributes(changedAttributes) {
    const {positionAttributeName = 'positions'} = this.state;
    let attributesChanged = false;
    let positionsChanged = false;
    for (const name in changedAttributes) {
      attributesChanged = true;
      if (name === positionAttributeName) {
        positionsChanged = true;
        break;
      }
    }
    this.setState({attributesChanged, positionsChanged});
  }

  getAttributes() {
    return this.getAttributeManager().getShaderAttributes();
  }

  getModuleSettings() {
    // For regular layer draw this happens during draw cycle (_drawLayersInViewport) not during update cycle
    // For aggregation layers this is called during updateState to update aggregation data
    // NOTE: it is similar to LayerPass._getModuleParameters() but doesn't inlcude `effects` it is not needed for aggregation
    const {viewport, mousePosition, gl} = this.context;
    const moduleSettings = Object.assign(Object.create(this.props), {
      viewport,
      mousePosition,
      pickingActive: 0,
      devicePixelRatio: cssToDeviceRatio(gl)
    });
    return moduleSettings;
  }

  updateShaders(shaders) {
    // Default implemention is empty, subclasses can update their Model objects if needed
  }

  isAggregationDataDirty(updateOpts, params = {}) {
    const {props, oldProps, changeFlags} = updateOpts;
    const {detectExtensionChange = false, dimension} = params;
    const {ignoreProps} = this.state;
    const {props: dataProps, accessors} = dimension;
    const {updateTriggersChanged} = changeFlags;
    if (updateTriggersChanged) {
      if (updateTriggersChanged.all) {
        return true;
      }
      if (accessors.some(accessor => updateTriggersChanged[accessor])) {
        return true;
      }
    }
    if (detectExtensionChange) {
      if (changeFlags.extensionsChanged) {
        return true;
      }
      if (
        compareProps({
          oldProps,
          newProps: props,
          ignoreProps,
          propTypes: this.constructor._propTypes
        })
      ) {
        return true;
      }
    } else {
      let propChanged = false;
      for (const name of dataProps) {
        if (props[name] !== oldProps[name]) {
          propChanged = true;
          break;
        }
      }
      if (propChanged) {
        return true;
      }
    }
    return false;
  }

  // Private

  // override Composite layer private method to create AttributeManager instance
  _getAttributeManager() {
    return new AttributeManager(this.context.gl, {
      id: this.props.id,
      stats: this.context.stats
    });
  }
}

AggregationLayer.layerName = 'AggregationLayer';
