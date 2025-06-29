'use client';

import { useEffect, useRef } from 'react';

interface FluidConfig {
  SIM_RESOLUTION: number;
  DYE_RESOLUTION: number;
  DENSITY_DISSIPATION: number;
  VELOCITY_DISSIPATION: number;
  PRESSURE: number;
  CURL: number;
  SPLAT_RADIUS: number;
  SPLAT_FORCE: number;
}

const defaultConfig: FluidConfig = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 0.97,
  VELOCITY_DISSIPATION: 0.98,
  PRESSURE: 0.8,
  CURL: 30,
  SPLAT_RADIUS: 0.25,
  SPLAT_FORCE: 6000,
};

// Shader sources
const baseVertexShader = `
  precision highp float;
  attribute vec2 aPosition;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;
  
  void main () {
    vUv = aPosition * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const displayShader = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTexture;
  
  void main () {
    vec3 C = texture2D(uTexture, vUv).rgb;
    float a = max(C.r, max(C.g, C.b));
    gl_FragColor = vec4(C, a);
  }
`;

const velocitySplatShader = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  
  void main () {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    // Simple addition for velocity - no dampening
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

const dyeSplatShader = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  
  void main () {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    float influence = exp(-dot(p, p) / radius);
    vec3 base = texture2D(uTarget, vUv).xyz;
    
    // Use a weighted blend that preserves colors instead of pure addition
    // This prevents white accumulation while keeping vibrant colors
    float baseWeight = 1.0 - influence * 0.5;
    vec3 blended = base * baseWeight + color * influence;
    
    // Soft clamp to prevent harsh color cutoffs while maintaining saturation
    blended = mix(blended, normalize(blended) * length(blended), 0.3);
    
    gl_FragColor = vec4(blended, 1.0);
  }
`;

const advectionShader = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform vec2 dyeTexelSize;
  uniform float dt;
  uniform float dissipation;
  
  vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
    vec2 st = uv / tsize - 0.5;
    vec2 iuv = floor(st);
    vec2 fuv = fract(st);
    vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
    vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
    vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
    vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
    return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
  }
  
  void main () {
    vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
    vec4 result = bilerp(uSource, coord, dyeTexelSize);
    float decay = 1.0 + dissipation * dt;
    gl_FragColor = result / decay;
  }
`;

const divergenceShader = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uVelocity;
  
  void main () {
    float L = texture2D(uVelocity, vL).x;
    float R = texture2D(uVelocity, vR).x;
    float T = texture2D(uVelocity, vT).y;
    float B = texture2D(uVelocity, vB).y;
    vec2 C = texture2D(uVelocity, vUv).xy;
    float div = 0.5 * (R - L + T - B);
    gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
  }
`;

const curlShader = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uVelocity;
  
  void main () {
    float L = texture2D(uVelocity, vL).y;
    float R = texture2D(uVelocity, vR).y;
    float T = texture2D(uVelocity, vT).x;
    float B = texture2D(uVelocity, vB).x;
    float vorticity = R - L - T + B;
    gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
  }
`;

const vorticityShader = `
  precision highp float;
  precision highp sampler2D;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform sampler2D uVelocity;
  uniform sampler2D uCurl;
  uniform float curl;
  uniform float dt;
  
  void main () {
    float L = texture2D(uCurl, vL).x;
    float R = texture2D(uCurl, vR).x;
    float T = texture2D(uCurl, vT).x;
    float B = texture2D(uCurl, vB).x;
    float C = texture2D(uCurl, vUv).x;
    vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
    force /= length(force) + 0.0001;
    force *= curl * C;
    force.y *= -1.0;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity += force * dt;
    velocity = min(max(velocity, -1000.0), 1000.0);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

const pressureShader = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uDivergence;
  
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    float C = texture2D(uPressure, vUv).x;
    float divergence = texture2D(uDivergence, vUv).x;
    float pressure = (L + R + B + T - divergence) * 0.25;
    gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
  }
`;

const gradientSubtractShader = `
  precision mediump float;
  precision mediump sampler2D;
  varying highp vec2 vUv;
  varying highp vec2 vL;
  varying highp vec2 vR;
  varying highp vec2 vT;
  varying highp vec2 vB;
  uniform sampler2D uPressure;
  uniform sampler2D uVelocity;
  
  void main () {
    float L = texture2D(uPressure, vL).x;
    float R = texture2D(uPressure, vR).x;
    float T = texture2D(uPressure, vT).x;
    float B = texture2D(uPressure, vB).x;
    vec2 velocity = texture2D(uVelocity, vUv).xy;
    velocity.xy -= vec2(R - L, T - B);
    gl_FragColor = vec4(velocity, 0.0, 1.0);
  }
`;

interface FluidSimulationProps {
  onReady?: (api: FluidSimulationAPI) => void;
  config?: Partial<FluidConfig>;
}

export interface FluidSimulationAPI {
  splat: (
    x: number,
    y: number,
    dx: number,
    dy: number,
    color?: [number, number, number],
  ) => void;
  resize: () => void;
}

export function FluidSimulation({
  onReady,
  config = {},
}: FluidSimulationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programsRef = useRef<any>({});
  const framebuffersRef = useRef<any>({});
  const animationFrameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    glRef.current = gl;

    // Initialize WebGL extensions
    const _ext = gl.getExtension('OES_texture_float');
    const supportLinearFiltering = gl.getExtension('OES_texture_float_linear');

    const mergedConfig = { ...defaultConfig, ...config };

    // Helper functions
    function compileShader(type: number, source: string) {
      if (!gl) throw new Error('WebGL context not available');
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Failed to create shader');

      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw gl.getShaderInfoLog(shader);
      }

      return shader;
    }

    function createProgram(vertexSource: string, fragmentSource: string) {
      if (!gl) throw new Error('WebGL context not available');
      const program = gl.createProgram();
      if (!program) throw new Error('Failed to create program');

      const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw gl.getProgramInfoLog(program);
      }

      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < uniformCount; i++) {
        const uniformInfo = gl.getActiveUniform(program, i);
        if (uniformInfo) {
          uniforms[uniformInfo.name] = gl.getUniformLocation(
            program,
            uniformInfo.name,
          );
        }
      }

      return { program, uniforms };
    }

    function createFBO(
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number,
    ) {
      if (!gl) throw new Error('WebGL context not available');
      gl.activeTexture(gl.TEXTURE0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        w,
        h,
        0,
        format,
        type,
        null,
      );

      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);

      return {
        texture,
        fbo,
        width: w,
        height: h,
        attach(id: number) {
          if (!gl) return id;
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        },
      };
    }

    function createDoubleFBO(
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number,
    ) {
      let fbo1 = createFBO(w, h, internalFormat, format, type, param);
      let fbo2 = createFBO(w, h, internalFormat, format, type, param);

      return {
        width: w,
        height: h,
        texelSizeX: 1.0 / w,
        texelSizeY: 1.0 / h,
        get read() {
          return fbo1;
        },
        set read(value) {
          fbo1 = value;
        },
        get write() {
          return fbo2;
        },
        set write(value) {
          fbo2 = value;
        },
        swap() {
          const temp = fbo1;
          fbo1 = fbo2;
          fbo2 = temp;
        },
      };
    }

    // Create vertex buffer
    const vertices = new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Create programs
    programsRef.current = {
      display: createProgram(baseVertexShader, displayShader),
      velocitySplat: createProgram(baseVertexShader, velocitySplatShader),
      dyeSplat: createProgram(baseVertexShader, dyeSplatShader),
      advection: createProgram(baseVertexShader, advectionShader),
      divergence: createProgram(baseVertexShader, divergenceShader),
      curl: createProgram(baseVertexShader, curlShader),
      vorticity: createProgram(baseVertexShader, vorticityShader),
      pressure: createProgram(baseVertexShader, pressureShader),
      gradientSubtract: createProgram(baseVertexShader, gradientSubtractShader),
    };

    // Initialize framebuffers
    function initFramebuffers() {
      const simRes = getResolution(mergedConfig.SIM_RESOLUTION);
      const dyeRes = getResolution(mergedConfig.DYE_RESOLUTION);

      framebuffersRef.current = {
        dye: createDoubleFBO(
          dyeRes.width,
          dyeRes.height,
          gl!.RGBA,
          gl!.RGBA,
          gl!.UNSIGNED_BYTE,
          supportLinearFiltering ? gl!.LINEAR : gl!.NEAREST,
        ),
        velocity: createDoubleFBO(
          simRes.width,
          simRes.height,
          gl!.RGBA,
          gl!.RGBA,
          gl!.UNSIGNED_BYTE,
          supportLinearFiltering ? gl!.LINEAR : gl!.NEAREST,
        ),
        divergence: createFBO(
          simRes.width,
          simRes.height,
          gl!.RGBA,
          gl!.RGBA,
          gl!.UNSIGNED_BYTE,
          gl!.NEAREST,
        ),
        curl: createFBO(
          simRes.width,
          simRes.height,
          gl!.RGBA,
          gl!.RGBA,
          gl!.UNSIGNED_BYTE,
          gl!.NEAREST,
        ),
        pressure: createDoubleFBO(
          simRes.width,
          simRes.height,
          gl!.RGBA,
          gl!.RGBA,
          gl!.UNSIGNED_BYTE,
          gl!.NEAREST,
        ),
      };
    }

    function getResolution(resolution: number) {
      if (!gl) throw new Error('WebGL context not available');
      const aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspectRatio < 1) {
        return {
          width: Math.round(resolution * aspectRatio),
          height: resolution,
        };
      }
      return {
        width: resolution,
        height: Math.round(resolution / aspectRatio),
      };
    }

    function resizeCanvas() {
      if (!canvas || !gl) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        initFramebuffers();
      }
    }

    // Bind attributes
    function bindAttribute(
      program: any,
      attribute: string,
      buffer: WebGLBuffer,
      size: number,
    ) {
      if (!gl) return;
      const location = gl.getAttribLocation(program.program, attribute);
      gl.enableVertexAttribArray(location);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    }

    // Main rendering functions
    function blit(target: any) {
      if (!gl || !buffer) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      bindAttribute(programsRef.current.display, 'aPosition', buffer, 2);
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a React hook
      gl.useProgram(programsRef.current.display.program);

      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }

      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
    }

    function splat(
      x: number,
      y: number,
      dx: number,
      dy: number,
      color: [number, number, number],
    ) {
      if (!gl || !buffer || !canvas) return;

      // Apply SPLAT_FORCE to velocity
      const forcedDx = dx * mergedConfig.SPLAT_FORCE;
      const forcedDy = dy * mergedConfig.SPLAT_FORCE;

      // First, apply velocity using velocitySplat shader
      const velocityProgram = programsRef.current.velocitySplat;
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a React hook
      gl.useProgram(velocityProgram.program);
      bindAttribute(velocityProgram, 'aPosition', buffer, 2);

      gl.uniform1i(
        velocityProgram.uniforms.uTarget,
        framebuffersRef.current.velocity.read.attach(0),
      );
      gl.uniform1f(
        velocityProgram.uniforms.aspectRatio,
        canvas.width / canvas.height,
      );
      gl.uniform2f(velocityProgram.uniforms.point, x, y);
      gl.uniform3f(velocityProgram.uniforms.color, forcedDx, forcedDy, 0.0);
      gl.uniform1f(
        velocityProgram.uniforms.radius,
        mergedConfig.SPLAT_RADIUS / 100.0,
      );

      gl.viewport(
        0,
        0,
        framebuffersRef.current.velocity.width,
        framebuffersRef.current.velocity.height,
      );
      gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        framebuffersRef.current.velocity.write.fbo,
      );
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      framebuffersRef.current.velocity.swap();

      // Then, apply dye using dyeSplat shader
      const dyeProgram = programsRef.current.dyeSplat;
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a React hook
      gl.useProgram(dyeProgram.program);
      bindAttribute(dyeProgram, 'aPosition', buffer, 2);

      gl.uniform1i(
        dyeProgram.uniforms.uTarget,
        framebuffersRef.current.dye.read.attach(0),
      );
      gl.uniform1f(
        dyeProgram.uniforms.aspectRatio,
        canvas.width / canvas.height,
      );
      gl.uniform2f(dyeProgram.uniforms.point, x, y);
      gl.uniform3f(dyeProgram.uniforms.color, color[0], color[1], color[2]);
      gl.uniform1f(
        dyeProgram.uniforms.radius,
        mergedConfig.SPLAT_RADIUS / 100.0,
      );

      gl.viewport(
        0,
        0,
        framebuffersRef.current.dye.width,
        framebuffersRef.current.dye.height,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffersRef.current.dye.write.fbo);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      framebuffersRef.current.dye.swap();
    }

    function step(dt: number) {
      if (!gl || !buffer) return;
      gl.disable(gl.BLEND);

      // Curl
      const curlProgram = programsRef.current.curl;
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a React hook
      gl.useProgram(curlProgram.program);
      bindAttribute(curlProgram, 'aPosition', buffer, 2);
      gl.uniform2f(
        curlProgram.uniforms.texelSize,
        framebuffersRef.current.velocity.texelSizeX,
        framebuffersRef.current.velocity.texelSizeY,
      );
      gl.uniform1i(
        curlProgram.uniforms.uVelocity,
        framebuffersRef.current.velocity.read.attach(0),
      );
      gl.viewport(
        0,
        0,
        framebuffersRef.current.curl.width,
        framebuffersRef.current.curl.height,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffersRef.current.curl.fbo);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

      // Vorticity
      const vorticityProgram = programsRef.current.vorticity;
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a React hook
      gl.useProgram(vorticityProgram.program);
      bindAttribute(vorticityProgram, 'aPosition', buffer, 2);
      gl.uniform2f(
        vorticityProgram.uniforms.texelSize,
        framebuffersRef.current.velocity.texelSizeX,
        framebuffersRef.current.velocity.texelSizeY,
      );
      gl.uniform1i(
        vorticityProgram.uniforms.uVelocity,
        framebuffersRef.current.velocity.read.attach(0),
      );
      gl.uniform1i(
        vorticityProgram.uniforms.uCurl,
        framebuffersRef.current.curl.attach(1),
      );
      gl.uniform1f(vorticityProgram.uniforms.curl, mergedConfig.CURL);
      gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      gl.viewport(
        0,
        0,
        framebuffersRef.current.velocity.width,
        framebuffersRef.current.velocity.height,
      );
      gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        framebuffersRef.current.velocity.write.fbo,
      );
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      framebuffersRef.current.velocity.swap();

      // Divergence
      const divergenceProgram = programsRef.current.divergence;
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a React hook
      gl.useProgram(divergenceProgram.program);
      bindAttribute(divergenceProgram, 'aPosition', buffer, 2);
      gl.uniform2f(
        divergenceProgram.uniforms.texelSize,
        framebuffersRef.current.velocity.texelSizeX,
        framebuffersRef.current.velocity.texelSizeY,
      );
      gl.uniform1i(
        divergenceProgram.uniforms.uVelocity,
        framebuffersRef.current.velocity.read.attach(0),
      );
      gl.viewport(
        0,
        0,
        framebuffersRef.current.divergence.width,
        framebuffersRef.current.divergence.height,
      );
      gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        framebuffersRef.current.divergence.fbo,
      );
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

      // Pressure
      const pressureProgram = programsRef.current.pressure;
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a React hook
      gl.useProgram(pressureProgram.program);
      bindAttribute(pressureProgram, 'aPosition', buffer, 2);
      gl.uniform2f(
        pressureProgram.uniforms.texelSize,
        framebuffersRef.current.pressure.texelSizeX,
        framebuffersRef.current.pressure.texelSizeY,
      );
      gl.uniform1i(
        pressureProgram.uniforms.uDivergence,
        framebuffersRef.current.divergence.attach(0),
      );

      for (let i = 0; i < 20; i++) {
        gl.uniform1i(
          pressureProgram.uniforms.uPressure,
          framebuffersRef.current.pressure.read.attach(1),
        );
        gl.viewport(
          0,
          0,
          framebuffersRef.current.pressure.width,
          framebuffersRef.current.pressure.height,
        );
        gl.bindFramebuffer(
          gl.FRAMEBUFFER,
          framebuffersRef.current.pressure.write.fbo,
        );
        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
        framebuffersRef.current.pressure.swap();
      }

      // Gradient subtract
      const gradientProgram = programsRef.current.gradientSubtract;
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a React hook
      gl.useProgram(gradientProgram.program);
      bindAttribute(gradientProgram, 'aPosition', buffer, 2);
      gl.uniform2f(
        gradientProgram.uniforms.texelSize,
        framebuffersRef.current.velocity.texelSizeX,
        framebuffersRef.current.velocity.texelSizeY,
      );
      gl.uniform1i(
        gradientProgram.uniforms.uPressure,
        framebuffersRef.current.pressure.read.attach(0),
      );
      gl.uniform1i(
        gradientProgram.uniforms.uVelocity,
        framebuffersRef.current.velocity.read.attach(1),
      );
      gl.viewport(
        0,
        0,
        framebuffersRef.current.velocity.width,
        framebuffersRef.current.velocity.height,
      );
      gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        framebuffersRef.current.velocity.write.fbo,
      );
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      framebuffersRef.current.velocity.swap();

      // Advection
      const advectionProgram = programsRef.current.advection;
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a React hook
      gl.useProgram(advectionProgram.program);
      bindAttribute(advectionProgram, 'aPosition', buffer, 2);

      // Advect velocity
      gl.uniform2f(
        advectionProgram.uniforms.texelSize,
        framebuffersRef.current.velocity.texelSizeX,
        framebuffersRef.current.velocity.texelSizeY,
      );
      gl.uniform2f(
        advectionProgram.uniforms.dyeTexelSize,
        framebuffersRef.current.velocity.texelSizeX,
        framebuffersRef.current.velocity.texelSizeY,
      );
      gl.uniform1i(
        advectionProgram.uniforms.uVelocity,
        framebuffersRef.current.velocity.read.attach(0),
      );
      gl.uniform1i(
        advectionProgram.uniforms.uSource,
        framebuffersRef.current.velocity.read.attach(0),
      );
      gl.uniform1f(advectionProgram.uniforms.dt, dt);
      gl.uniform1f(
        advectionProgram.uniforms.dissipation,
        mergedConfig.VELOCITY_DISSIPATION,
      );
      gl.viewport(
        0,
        0,
        framebuffersRef.current.velocity.width,
        framebuffersRef.current.velocity.height,
      );
      gl.bindFramebuffer(
        gl.FRAMEBUFFER,
        framebuffersRef.current.velocity.write.fbo,
      );
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      framebuffersRef.current.velocity.swap();

      // Advect dye
      gl.uniform2f(
        advectionProgram.uniforms.dyeTexelSize,
        framebuffersRef.current.dye.texelSizeX,
        framebuffersRef.current.dye.texelSizeY,
      );
      gl.uniform1i(
        advectionProgram.uniforms.uVelocity,
        framebuffersRef.current.velocity.read.attach(0),
      );
      gl.uniform1i(
        advectionProgram.uniforms.uSource,
        framebuffersRef.current.dye.read.attach(1),
      );
      gl.uniform1f(
        advectionProgram.uniforms.dissipation,
        mergedConfig.DENSITY_DISSIPATION,
      );
      gl.viewport(
        0,
        0,
        framebuffersRef.current.dye.width,
        framebuffersRef.current.dye.height,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffersRef.current.dye.write.fbo);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
      framebuffersRef.current.dye.swap();
    }

    let lastTime = 0;
    function render(currentTime: number) {
      if (!gl) return;
      const dt = Math.min((currentTime - lastTime) / 1000, 0.016);
      lastTime = currentTime;

      resizeCanvas();

      if (dt > 0) {
        step(dt);
      }

      // Display
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);

      const displayProgram = programsRef.current.display;
      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is not a React hook
      gl.useProgram(displayProgram.program);
      bindAttribute(displayProgram, 'aPosition', buffer!, 2);
      gl.uniform1i(
        displayProgram.uniforms.uTexture,
        framebuffersRef.current.dye.read.attach(0),
      );

      blit(null);

      animationFrameRef.current = requestAnimationFrame(render);
    }

    // Initialize and start
    resizeCanvas();
    initFramebuffers();

    animationFrameRef.current = requestAnimationFrame(render);

    // Create API
    const api: FluidSimulationAPI = {
      splat: (
        x: number,
        y: number,
        dx: number,
        dy: number,
        color = [0.2, 0.5, 1.0],
      ) => {
        splat(x, y, dx, dy, color as [number, number, number]);
      },
      resize: () => {
        resizeCanvas();
      },
    };

    if (onReady) {
      onReady(api);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [config, onReady]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      style={{
        opacity: 0.5,
        pointerEvents: 'none',
      }}
    />
  );
}
