/**
 * XIMVID — src/components/AppBackground.js
 * ─────────────────────────────────────────────────────────────────
 * Fondo reutilizable para TODAS las pantallas.
 * Azul tecnológico claro + círculos concéntricos + código binario.
 * Renderizado en canvas — carga instantánea, cero imágenes externas.
 *
 * Uso:
 *   import AppBackground from '@components/AppBackground';
 *   <AppBackground><TuContenido /></AppBackground>
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Canvas, useCanvasRef } from '@shopify/react-native-skia';

const { width: W, height: H } = Dimensions.get('window');

// ─── Parámetros visuales ──────────────────────────────────────────
const CX = W * 0.72;   // Centro X de los círculos concéntricos
const CY = H * 0.26;   // Centro Y de los círculos concéntricos

// ─── Componente principal ─────────────────────────────────────────
// Usamos react-native-canvas para máxima compatibilidad con Expo
// sin necesidad de Skia. Canvas se renderiza una sola vez (memoizado).

import { Canvas as RNCanvas } from 'react-native-canvas';

export default function AppBackground({ children }) {
  const canvasRef = useRef(null);

  const drawBackground = async (canvas) => {
    if (!canvas) return;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Gradiente base azul ──────────────────────────────────────
    const grad = ctx.createLinearGradient(0, 0, W * 0.4, H);
    grad.addColorStop(0,    '#b8dff5');
    grad.addColorStop(0.35, '#8ecaec');
    grad.addColorStop(0.7,  '#6ab5e2');
    grad.addColorStop(1,    '#4a9fd4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ── Viñeta oscura en bordes ──────────────────────────────────
    const vignette = ctx.createRadialGradient(
      W/2, H/2, H*0.18,
      W/2, H/2, H*0.88
    );
    vignette.addColorStop(0,    'rgba(0,30,60,0)');
    vignette.addColorStop(0.55, 'rgba(0,20,55,0.18)');
    vignette.addColorStop(1,    'rgba(0,10,40,0.50)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // ── Sombra inferior ──────────────────────────────────────────
    const bottomShade = ctx.createLinearGradient(0, H * 0.5, 0, H);
    bottomShade.addColorStop(0, 'rgba(0,20,50,0)');
    bottomShade.addColorStop(1, 'rgba(0,12,38,0.42)');
    ctx.fillStyle = bottomShade;
    ctx.fillRect(0, 0, W, H);

    // ── Luz difusa arriba-izquierda ──────────────────────────────
    const lightBlob = ctx.createRadialGradient(55, 75, 10, 55, 75, 200);
    lightBlob.addColorStop(0, 'rgba(255,255,255,0.24)');
    lightBlob.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lightBlob;
    ctx.fillRect(0, 0, W, H);

    // ── Círculos concéntricos ────────────────────────────────────
    const circles = [
      {r:210,sw:0.7,op:0.22}, {r:180,sw:0.5,op:0.18},
      {r:150,sw:1.0,op:0.28}, {r:122,sw:0.8,op:0.33},
      {r:96, sw:1.3,op:0.42}, {r:72, sw:0.8,op:0.48},
      {r:50, sw:1.6,op:0.62}, {r:30, sw:1.2,op:0.70},
    ];

    circles.forEach(c => {
      ctx.beginPath();
      ctx.arc(CX, CY, c.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(20,140,200,${c.op})`;
      ctx.lineWidth   = c.sw;
      ctx.stroke();
    });

    // ── Glow central ────────────────────────────────────────────
    const cg = ctx.createRadialGradient(CX, CY, 0, CX, CY, 18);
    cg.addColorStop(0, 'rgba(160,230,255,0.9)');
    cg.addColorStop(1, 'rgba(80,190,240,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(CX, CY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Punto central
    ctx.beginPath();
    ctx.arc(CX, CY, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(210,245,255,0.92)';
    ctx.fill();

    // ── Líneas de circuito ───────────────────────────────────────
    ctx.strokeStyle = 'rgba(20,130,190,0.5)';
    ctx.lineWidth   = 1;

    const lines = [
      [[W*.18,H*.28],[W*.04,H*.28]],
      [[W*.18,H*.28],[W*.18,H*.38],[W*.07,H*.38]],
      [[W*.30,H*.50],[W*.19,H*.50],[W*.19,H*.60],[W*.09,H*.60]],
      [[W*.40,H*.66],[W*.40,H*.75],[W*.26,H*.75],[W*.26,H*.84],[W*.14,H*.84]],
      [[W*.85,H*.53],[W*.96,H*.53],[W*.96,H*.65],[W*.88,H*.65]],
    ];

    lines.forEach(pts => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    });

    // Nodos en extremos de las líneas
    const nodes = [
      [W*.04,H*.28],[W*.07,H*.38],[W*.09,H*.60],[W*.14,H*.84],[W*.88,H*.65],
    ];
    nodes.forEach(([nx, ny]) => {
      ctx.beginPath();
      ctx.arc(nx, ny, 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(40,180,230,0.75)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(nx, ny, 1.8, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(100,220,255,0.9)';
      ctx.fill();
    });

    // Círculo secundario abajo-izquierda
    const cx2 = W * 0.22, cy2 = H * 0.72;
    [50, 34, 20, 9].forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(cx2, cy2, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(25,145,200,${0.25 + i * 0.1})`;
      ctx.lineWidth   = i >= 2 ? 1.1 : 0.7;
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.arc(cx2, cy2, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100,220,255,0.82)';
    ctx.fill();

    // ── Código binario ───────────────────────────────────────────
    const FONT_SIZE = 17;
    const LINE_H    = FONT_SIZE + 6;
    const COLS      = 15;
    const COL_W     = W / COLS;
    const ROWS      = Math.ceil(H / LINE_H) + 1;

    ctx.font = `500 ${FONT_SIZE}px monospace`;

    for (let col = 0; col < COLS; col++) {
      const x      = col * COL_W + COL_W * 0.42;
      const center = COLS / 2;
      const dist   = Math.abs(col - center) / (COLS / 2);
      const baseOp = 0.13 + (1 - dist) * 0.14;

      for (let row = 0; row < ROWS; row++) {
        const y   = row * LINE_H + FONT_SIZE;
        const bit = ((col * 13 + row * 29 + col * row * 11) % 3 === 0) ? '0' : '1';

        const vertRatio = row / ROWS;
        let vertOp = baseOp;
        if (vertRatio < 0.10) vertOp = baseOp * (vertRatio / 0.10);
        if (vertRatio > 0.90) vertOp = baseOp * ((1 - vertRatio) / 0.10);

        ctx.fillStyle = `rgba(0,35,75,${vertOp})`;
        ctx.fillText(bit, x, y);
      }
    }

    // Sombra final inferior sobre el binario
    const finalShade = ctx.createLinearGradient(0, H * 0.68, 0, H);
    finalShade.addColorStop(0, 'rgba(0,20,50,0)');
    finalShade.addColorStop(1, 'rgba(0,15,42,0.28)');
    ctx.fillStyle = finalShade;
    ctx.fillRect(0, 0, W, H);
  };

  return (
    <View style={styles.container}>
      <RNCanvas
        ref={canvasRef}
        style={styles.canvas}
        onContext2D={drawBackground}
      />
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#8ecaec', // Color de fallback mientras carga el canvas
  },
  canvas: {
    position: 'absolute',
    top:      0,
    left:     0,
    width:    W,
    height:   H,
  },
  content: {
    flex: 1,
  },
});
