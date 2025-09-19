"use client"

import { useRef, useEffect } from 'react'

interface WaterDistortionShaderProps {
  className?: string
  intensity?: number
  speed?: number
}

export function WaterDistortionShader({ 
  className = "", 
  intensity = 0.5,
  speed = 1.0
}: WaterDistortionShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) {
      console.warn('WebGL not supported, falling back to canvas 2D')
      return
    }

    // Vertex shader source
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `

    // Fragment shader source - water distortion effect
    const fragmentShaderSource = `
      precision mediump float;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_intensity;
      varying vec2 v_texCoord;
      
      // Simplex noise function
      vec3 mod289(vec3 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      
      vec4 mod289(vec4 x) {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
      }
      
      vec4 permute(vec4 x) {
        return mod289(((x*34.0)+1.0)*x);
      }
      
      vec4 taylorInvSqrt(vec4 r) {
        return 1.79284291400159 - 0.85373472095314 * r;
      }
      
      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        vec3 i = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        
        i = mod289(i);
        vec4 p = permute(permute(permute(
          i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        
        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        
        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        
        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }
      
      void main() {
        vec2 uv = v_texCoord;
        vec2 resolution = u_resolution;
        
        // Create water-like distortion
        float time = u_time * 0.5;
        vec2 pos = uv * 4.0;
        
        float noise1 = snoise(vec3(pos * 2.0, time * 0.1));
        float noise2 = snoise(vec3(pos * 3.0, time * 0.15));
        float noise3 = snoise(vec3(pos * 1.5, time * 0.08));
        
        // Combine noises for complex water movement
        vec2 distortion = vec2(
          noise1 * 0.02 + noise2 * 0.01 + noise3 * 0.015,
          noise1 * 0.015 + noise2 * 0.02 + noise3 * 0.01
        ) * u_intensity;
        
        vec2 distortedUV = uv + distortion;
        
        // Create depth-based color gradient
        float depth = 1.0 - uv.y;
        vec3 deepColor = vec3(0.02, 0.05, 0.15);      // Deep ocean
        vec3 shallowColor = vec3(0.05, 0.3, 0.4);     // Shallow water
        vec3 surfaceColor = vec3(0.3, 0.6, 0.8);      // Surface
        
        vec3 baseColor = mix(deepColor, shallowColor, depth * 0.7);
        baseColor = mix(baseColor, surfaceColor, pow(depth, 3.0) * 0.3);
        
        // Add caustic-like patterns
        float caustics = snoise(vec3(distortedUV * 8.0, time * 0.2));
        caustics = pow(max(0.0, caustics), 2.0);
        baseColor += caustics * 0.1 * depth;
        
        // Add some shimmer on top
        float shimmer = snoise(vec3(distortedUV * 12.0, time * 0.3));
        shimmer = pow(max(0.0, shimmer), 3.0);
        baseColor += shimmer * 0.05 * pow(depth, 2.0);
        
        gl_FragColor = vec4(baseColor, 0.8);
      }
    `

    // Create shader
    function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
      const shader = gl.createShader(type)
      if (!shader) return null
      
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      
      return shader
    }

    // Create program
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
    
    if (!vertexShader || !fragmentShader) {
      console.error('Failed to create shaders')
      return
    }

    const program = gl.createProgram()
    if (!program) {
      console.error('Failed to create program')
      return
    }

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Error linking program:', gl.getProgramInfoLog(program))
      return
    }

    // Set up geometry
    const positions = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
      -1,  1,  0, 1,
       1, -1,  1, 0,
       1,  1,  1, 1,
    ])

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')
    const timeLocation = gl.getUniformLocation(program, 'u_time')
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
    const intensityLocation = gl.getUniformLocation(program, 'u_intensity')

    // Resize canvas
    const resizeCanvas = () => {
      const displayWidth = canvas.offsetWidth
      const displayHeight = canvas.offsetHeight

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth
        canvas.height = displayHeight
        gl.viewport(0, 0, displayWidth, displayHeight)
      }
    }

    // Animation loop
    const animate = () => {
      resizeCanvas()
      
      const currentTime = (Date.now() - startTimeRef.current) * 0.001 * speed
      
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      
      gl.useProgram(program)
      
      // Set uniforms
      gl.uniform1f(timeLocation, currentTime)
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
      gl.uniform1f(intensityLocation, intensity)
      
      // Set up attributes
      gl.enableVertexAttribArray(positionLocation)
      gl.enableVertexAttribArray(texCoordLocation)
      
      const stride = 4 * Float32Array.BYTES_PER_ELEMENT
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0)
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT)
      
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      
      // Cleanup WebGL resources
      gl.deleteProgram(program)
      gl.deleteShader(vertexShader)
      gl.deleteShader(fragmentShader)
      gl.deleteBuffer(buffer)
    }
  }, [intensity, speed])

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none mix-blend-overlay ${className}`}
      style={{ width: '100%', height: '100%' }}
    />
  )
}