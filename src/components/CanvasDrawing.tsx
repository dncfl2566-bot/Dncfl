import React, { useRef, useState, useEffect } from 'react';
import { Pencil, Trash2, RotateCcw, ShieldCheck } from 'lucide-react';

interface CanvasDrawingProps {
  initialData?: string; // base64 URL
  onChange: (base64: string) => void;
  disabled?: boolean;
}

export default function CanvasDrawing({ initialData, onChange, disabled = false }: CanvasDrawingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#002B49'); // Navy default
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Initialize and handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on container
    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container) return;

      // Save current drawing
      const tempImage = new Image();
      const currentData = canvas.toDataURL('image/jpeg', 0.6);
      
      const width = container.clientWidth;
      const height = 350; // Fixed aesthetic height

      canvas.width = width;
      canvas.height = height;

      // Set defaults on context
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = isEraser ? '#ffffff' : color;
      ctx.lineWidth = lineWidth;

      // Fill background white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Restore drawing after resize or initial load
      if (initialData || currentData) {
        tempImage.src = initialData || currentData;
        tempImage.onload = () => {
          ctx.drawImage(tempImage, 0, 0, width, height);
        };
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Update stroke styles on change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = isEraser ? '#ffffff' : color;
    ctx.lineWidth = isEraser ? 16 : lineWidth;
  }, [color, lineWidth, isEraser]);

  // Handle canvas drawings
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    // Draw a point immediately on click
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    // Prevent scrolling on touch devices while drawing
    if (e.cancelable) {
      e.preventDefault();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveCanvasData();
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const saveCanvasData = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/jpeg', 0.6));
  };

  const clearCanvas = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange('');
  };

  return (
    <div className="w-full" id="canvas-drawing-container">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-pen"
            onClick={() => setIsEraser(false)}
            className={`p-2 rounded-md border flex items-center gap-1 text-sm font-medium transition-colors ${
              !isEraser ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Pencil size={16} />
            ดินสอ
          </button>
          <button
            type="button"
            id="btn-eraser"
            onClick={() => setIsEraser(true)}
            className={`p-2 rounded-md border flex items-center gap-1 text-sm font-medium transition-colors ${
              isEraser ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <RotateCcw size={16} />
            ยางลบ
          </button>
        </div>

        {!isEraser && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">สีเส้น:</span>
            <div className="flex gap-1.5">
              {[
                { hex: '#002B49', label: 'น้ำเงินเข้ม' },
                { hex: '#D22630', label: 'แดงวิชาการ' },
                { hex: '#0B0F19', label: 'ดำเข้ม' }
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  id={`btn-color-${c.hex.replace('#', '')}`}
                  onClick={() => setColor(c.hex)}
                  title={c.label}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color === c.hex ? 'scale-125 border-slate-400' : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>

            <span className="text-xs text-slate-500 ml-2 font-medium">ขนาดเส้น:</span>
            <select
              value={lineWidth}
              id="select-line-width"
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="text-xs bg-white border border-slate-200 rounded p-1 font-medium"
            >
              <option value={1}>บาง (1px)</option>
              <option value={3}>ปานกลาง (3px)</option>
              <option value={5}>หนา (5px)</option>
              <option value={8}>หนาพิเศษ (8px)</option>
            </select>
          </div>
        )}

        <button
          type="button"
          id="btn-clear-canvas"
          onClick={clearCanvas}
          className="p-2 text-red-600 hover:bg-red-50 rounded-md border border-red-200 text-sm font-medium flex items-center gap-1 transition-colors"
          disabled={disabled}
        >
          <Trash2 size={16} />
          ล้างหน้าจอ
        </button>
      </div>

      <div
        ref={containerRef}
        className="w-full relative border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white shadow-inner"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full block bg-white ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
          style={{ height: '350px' }}
        />
        {disabled && (
          <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <span className="bg-slate-800 text-white px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-md">
              <ShieldCheck size={14} className="text-green-400" />
              ส่งคำตอบแล้ว (ปิดการเขียน)
            </span>
          </div>
        )}
      </div>
      
      <p className="text-xs text-slate-400 mt-2 italic text-right">
        *สามารถใช้นิ้วมือหรือปากกาในการวาดแสดงวิธีทำในพื้นที่ด้านบนได้
      </p>
    </div>
  );
}
