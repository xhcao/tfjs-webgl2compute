/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import {computeDispatch} from '../webgl2compute_util';

import {WebGL2ComputeProgram} from './webgl2compute_program';

export class ResizeBilinearProgram implements WebGL2ComputeProgram {
  outputShape: number[];
  userCode: string;
  dispatchLayout: {x: number[], y: number[], z: number[]};
  workGroupSize: [number, number, number] = [64, 1, 1];
  dispatch: [number, number, number];
  variableNames = ['x'];

  constructor(
      inputShape: [number, number, number, number], newHeight: number,
      newWidth: number, alignCorners: boolean) {
    this.outputShape = [inputShape[0], newHeight, newWidth, inputShape[3]];

    this.dispatchLayout = {x: [1], y: [2], z: [0, 3]};

    this.dispatch = computeDispatch(this.dispatchLayout, this.outputShape);

    const adjustHeight = alignCorners && newHeight > 1;
    const adjustWidth = alignCorners && newWidth > 1;

    this.userCode = `
      void main() {
        ivec4 coords = getOutputCoords();

        if (all(lessThan(coords, outShape))) {
          int b = coords[0];
          int d = coords[3];
          ivec2 rc = coords.yz;

          vec2 effectiveInSize = vec2(
            ${adjustHeight ? 'xShape.y - 1' : 'xShape.y'},
            ${adjustWidth ? 'xShape.z - 1' : 'xShape.z'});

          vec2 effectiveOutSize = vec2(
            ${adjustHeight ? 'outShape.y - 1' : 'outShape.y'},
            ${adjustWidth ? 'outShape.z - 1' : 'outShape.z'});

          vec2 effectiveInputOverOutputRatioRC =
              effectiveInSize / effectiveOutSize;

          // Fractional source index
          vec2 sourceFracIndexRC = vec2(rc) * effectiveInputOverOutputRatioRC;

          // Compute the four integer indices.
          ivec2 sourceFloorRC = ivec2(sourceFracIndexRC);
          ivec2 sourceCeilRC = ivec2(
            min(xShape.y - 1, int(ceil(sourceFracIndexRC.x))),
            min(xShape.z - 1, int(ceil(sourceFracIndexRC.y)))
            );

          float topLeft = getX(b, sourceFloorRC.x, sourceFloorRC.y, d);
          float bottomLeft = getX(b, sourceCeilRC.x, sourceFloorRC.y, d);
          float topRight = getX(b, sourceFloorRC.x, sourceCeilRC.y, d);
          float bottomRight = getX(b, sourceCeilRC.x, sourceCeilRC.y, d);

          vec2 fracRC = sourceFracIndexRC - vec2(sourceFloorRC);

          float top = topLeft + (topRight - topLeft) * fracRC.y;
          float bottom = bottomLeft + (bottomRight - bottomLeft) * fracRC.y;
          float newValue = top + (bottom - top) * fracRC.x;

          setOutput(b, coords[1], coords[2], d, newValue);
        }
      }
    `;
  }
}
