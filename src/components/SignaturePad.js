import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

const THEME = {
  primary: '#1B5E20',
  textLight: '#666666',
  error: '#F44336',
};

// Web/Electron Signature Pad using HTML Canvas
const WebSignaturePad = forwardRef(({ onSignatureChange, style }, ref) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useImperativeHandle(ref, () => ({
    clearSignature: () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        setHasSignature(false);
        onSignatureChange && onSignatureChange(null);
      }
    },
    getSignature: () => {
      const canvas = canvasRef.current;
      if (canvas && hasSignature) {
        return canvas.toDataURL('image/png');
      }
      return null;
    },
  }));

  useEffect(() => {
    // Delay initialization to ensure DOM is ready
    const timer = setTimeout(() => {
      initCanvas();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set fixed dimensions
    canvas.width = 450;
    canvas.height = 200;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    setIsReady(true);
  };

  const getPosition = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDrawing(true);
    const pos = getPosition(e);
    lastPos.current = pos;
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPosition(e);

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPos.current = pos;

    if (!hasSignature) {
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    if (isDrawing && hasSignature) {
      const canvas = canvasRef.current;
      const signatureData = canvas.toDataURL('image/png');
      onSignatureChange && onSignatureChange(signatureData);
    }
    setIsDrawing(false);
  };

  return (
    <View style={[styles.container, style]} ref={containerRef}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            maxWidth: 450,
            height: 200,
            backgroundColor: '#FFFFFF',
            borderRadius: 8,
            border: '2px solid #1B5E20',
            touchAction: 'none',
            cursor: 'crosshair',
            display: 'block',
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <Text style={styles.hint}>
        {!isReady ? 'Initializing...' : hasSignature ? '✓ Signature captured' : 'Draw your signature above'}
      </Text>
    </View>
  );
});

// Native Signature Pad using react-native-signature-canvas
const NativeSignaturePad = forwardRef(({ onSignatureChange, style }, ref) => {
  const signatureRef = useRef(null);
  const [SignatureCanvas, setSignatureCanvas] = useState(null);

  useEffect(() => {
    // Dynamically import to avoid web build issues
    import('react-native-signature-canvas').then((module) => {
      setSignatureCanvas(() => module.default);
    }).catch((err) => {
      console.log('Could not load signature canvas:', err);
    });
  }, []);

  useImperativeHandle(ref, () => ({
    clearSignature: () => {
      signatureRef.current?.clearSignature();
      onSignatureChange && onSignatureChange(null);
    },
    getSignature: () => {
      signatureRef.current?.readSignature();
    },
  }));

  const handleEnd = () => {
    signatureRef.current?.readSignature();
  };

  const handleOK = (signatureData) => {
    onSignatureChange && onSignatureChange(signatureData);
  };

  if (!SignatureCanvas) {
    return (
      <View style={[styles.container, style, styles.loading]}>
        <Text style={styles.hint}>Loading signature pad...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <SignatureCanvas
        ref={signatureRef}
        onEnd={handleEnd}
        onOK={handleOK}
        onEmpty={() => onSignatureChange && onSignatureChange(null)}
        descriptionText=""
        clearText="Clear"
        confirmText="Save"
        webStyle={`
          .m-signature-pad { box-shadow: none; border: 1px solid #E0E0E0; border-radius: 8px; }
          .m-signature-pad--body { border: none; }
          .m-signature-pad--footer { display: none; }
          canvas { border-radius: 8px; }
        `}
        style={styles.signatureCanvas}
      />
    </View>
  );
});

// Main component that switches based on platform
const SignaturePad = forwardRef((props, ref) => {
  if (Platform.OS === 'web') {
    return <WebSignaturePad ref={ref} {...props} />;
  }
  return <NativeSignaturePad ref={ref} {...props} />;
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  signatureCanvas: {
    height: 200,
    backgroundColor: '#FFFFFF',
  },
  hint: {
    textAlign: 'center',
    color: THEME.textLight,
    fontSize: 12,
    marginTop: 8,
    paddingBottom: 8,
  },
  loading: {
    height: 200,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SignaturePad;
