import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Upload,
  User,
  RotateCw,
  RefreshCw,
  AlertCircle,
  Check,
  Sparkles,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { updateUserFace } from '../../services/api';
import { getImageUrl } from '../../utils/image';

export default function UserPhotoModal({ isOpen, user, onClose, onPhotoUpdated }) {
  const [activeTab, setActiveTab] = useState('view'); // 'view' | 'camera' | 'upload'
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Camera state
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Reset state when modal is opened/closed or user changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(user?.face_photo ? 'view' : 'camera');
      setPreviewUrl(null);
      setSelectedFile(null);
      setErrorMsg('');
      setCameraError(null);
    } else {
      stopCamera();
    }
  }, [isOpen, user]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraLoading(false);
    setCameraError(null);
  };

  const startCamera = async (mode = facingMode) => {
    stopCamera();
    setCameraLoading(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser Anda tidak mendukung akses kamera secara langsung. Silakan pilih opsi Unggah File.');
      }

      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (_) {}
      }
      setCameraLoading(false);
    } catch (err) {
      console.error('Camera error:', err);
      let msg = 'Tidak dapat membuka kamera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Izin kamera ditolak. Silakan izinkan akses kamera di peramban (browser) Anda.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Kamera tidak terdeteksi pada perangkat Anda.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Kamera sedang digunakan oleh aplikasi lain.';
      } else {
        msg = err.message || 'Gagal memulai kamera.';
      }
      setCameraError(msg);
      setCameraLoading(false);
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `master_face_${user?.id || 'user'}_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      processNewFile(file);
      stopCamera();
      setActiveTab('view');
    }, 'image/jpeg', 0.95);
  };

  const processNewFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Format file harus berupa gambar (.jpg, .jpeg, .png).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 5 MB.');
      return;
    }

    setErrorMsg('');
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processNewFile(file);
      setActiveTab('view');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processNewFile(file);
      setActiveTab('view');
    }
  };

  const handleSavePhoto = async () => {
    if (!selectedFile || !user) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('face_photo', selectedFile);

      const res = await updateUserFace(user.id, formData);
      if (res && res.success) {
        if (onPhotoUpdated) {
          onPhotoUpdated({
            ...user,
            face_photo: res.data?.face_photo || res.face_photo,
          });
        }
        setSelectedFile(null);
        setPreviewUrl(null);
        onClose();
      } else {
        setErrorMsg(res?.message || 'Gagal memperbarui foto master.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat mengunggah foto.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelNewPhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMsg('');
  };

  const openCameraTab = () => {
    handleCancelNewPhoto();
    setActiveTab('camera');
    startCamera(facingMode);
  };

  const openUploadTab = () => {
    handleCancelNewPhoto();
    setActiveTab('upload');
    stopCamera();
  };

  if (!isOpen || !user) return null;

  const currentPhotoUrl = user.face_photo ? getImageUrl(user.face_photo) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={styles.overlay}
      onClick={onClose}
    >
      <div
        style={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.iconBox}>
              <ImageIcon size={20} color="#1e5a8a" />
            </div>
            <div>
              <h3 style={styles.title}>Foto Master Wajah Biometrik</h3>
              <p style={styles.subtitle}>
                {user.name} • <span style={styles.nipText}>{user.nip || 'N/A'}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div style={styles.alertBox}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div style={styles.body}>
          {/* TAB 1: VIEW & PREVIEW MODE */}
          {activeTab === 'view' && (
            <div style={styles.viewContainer}>
              {previewUrl ? (
                // NEW PHOTO PREVIEW (UNSAVED)
                <div style={styles.photoBoxContainer}>
                  <div style={styles.badgeNew}>Foto Baru (Belum Disimpan)</div>
                  <div style={styles.imageFrame}>
                    <img
                      src={previewUrl}
                      alt="Preview Foto Baru"
                      style={styles.mainImage}
                    />
                  </div>
                  <p style={styles.fileInfoText}>
                    {selectedFile?.name} • {(selectedFile?.size / 1024).toFixed(1)} KB
                  </p>
                  <div style={styles.newPhotoActions}>
                    <button
                      type="button"
                      onClick={handleCancelNewPhoto}
                      style={styles.cancelNewBtn}
                    >
                      <Trash2 size={15} /> Batalkan Pilihan
                    </button>
                  </div>
                </div>
              ) : currentPhotoUrl ? (
                // CURRENT MASTER PHOTO
                <div style={styles.photoBoxContainer}>
                  <div style={styles.badgeActive}>Foto Master Aktif</div>
                  <div style={styles.imageFrame}>
                    <img
                      src={currentPhotoUrl}
                      alt={`Foto Master ${user.name}`}
                      style={styles.mainImage}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '';
                      }}
                    />
                  </div>
                  <p style={styles.helperText}>
                    Foto ini digunakan sistem AI untuk pencocokan wajah saat absensi.
                  </p>
                </div>
              ) : (
                // NO PHOTO YET
                <div style={styles.emptyPhotoBox}>
                  <div style={styles.emptyAvatar}>
                    <User size={48} color="#94a3b8" />
                  </div>
                  <h4 style={styles.emptyTitle}>Belum Ada Foto Master</h4>
                  <p style={styles.emptyDesc}>
                    Karyawan ini belum memiliki foto master biometrik untuk pengenalan wajah saat absensi.
                  </p>
                </div>
              )}

              {/* Action Buttons to trigger Camera or File Upload */}
              {!previewUrl && (
                <div style={styles.actionButtonGroup}>
                  <button
                    type="button"
                    onClick={openCameraTab}
                    style={styles.primaryActionBtn}
                  >
                    <Camera size={16} />
                    <span>Ambil Foto via Kamera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }}
                    style={styles.secondaryActionBtn}
                  >
                    <Upload size={16} />
                    <span>Unggah File Foto</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/jpg"
                    style={{ display: 'none' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE CAMERA CAPTURE */}
          {activeTab === 'camera' && (
            <div style={styles.cameraContainer}>
              <div style={styles.cameraViewfinder}>
                {cameraLoading && (
                  <div style={styles.cameraOverlay}>
                    <RefreshCw size={28} color="#38bdf8" className="animate-spin" />
                    <span style={{ fontSize: 13, color: '#f8fafc', fontWeight: 500 }}>
                      Membuka akses kamera...
                    </span>
                  </div>
                )}

                {cameraError ? (
                  <div style={styles.cameraOverlayError}>
                    <AlertCircle size={36} color="#ef4444" />
                    <p style={styles.cameraErrorText}>{cameraError}</p>
                    <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        style={styles.retryBtn}
                      >
                        Coba Lagi
                      </button>
                      <button
                        type="button"
                        onClick={openUploadTab}
                        style={styles.altBtn}
                      >
                        Unggah File Saja
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                      }}
                    />
                    {/* Face Oval Overlay */}
                    <div style={styles.faceOvalWrapper}>
                      <div style={styles.faceOval}>
                        <div style={styles.faceOvalBadge}>
                          <Sparkles size={12} />
                          Posisikan Wajah
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Camera Controls Bar */}
              <div style={styles.cameraControls}>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setActiveTab('view');
                  }}
                  style={styles.cameraCancelBtn}
                >
                  <X size={15} /> Batal
                </button>

                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={cameraLoading || Boolean(cameraError)}
                  style={styles.cameraCaptureBtn}
                >
                  <Camera size={18} />
                  <span>Ambil Foto</span>
                </button>

                <button
                  type="button"
                  onClick={switchCamera}
                  disabled={cameraLoading || Boolean(cameraError)}
                  style={styles.cameraSwitchBtn}
                  title="Ganti Kamera Depan / Belakang"
                >
                  <RotateCw size={16} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: FILE UPLOAD DROPZONE */}
          {activeTab === 'upload' && (
            <div style={styles.uploadContainer}>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  ...styles.dropzone,
                  ...(isDragging ? styles.dropzoneActive : {}),
                }}
              >
                <div style={styles.dropzoneIcon}>
                  <Upload size={28} color="#1e5a8a" />
                </div>
                <h4 style={styles.dropzoneTitle}>Pilih atau Seret Foto ke Sini</h4>
                <p style={styles.dropzoneSubtitle}>Mendukung format JPG, JPEG, PNG (Maks. 5MB)</p>
                <button
                  type="button"
                  style={styles.dropzoneBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Jelajahi File
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/jpg"
                  style={{ display: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('view')}
                  style={styles.cameraCancelBtn}
                >
                  Kembali ke Tampilan Foto
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={styles.footer}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={styles.modalCancelBtn}
          >
            Tutup
          </button>

          {previewUrl && (
            <button
              type="button"
              onClick={handleSavePhoto}
              disabled={loading}
              style={styles.modalSaveBtn}
            >
              {loading ? (
                <>
                  <div style={styles.spinnerMini} />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Simpan Perubahan Foto</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.65)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 16,
    animation: 'fadeIn 0.2s ease-out both',
  },
  card: {
    background: '#ffffff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    animation: 'fadeInUp 0.3s ease-out both',
  },
  header: {
    padding: '18px 24px',
    borderBottom: '1px solid #eef2f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#f8fafc',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: '#e0f2fe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    margin: '2px 0 0',
  },
  nipText: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 600,
    color: '#1e5a8a',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  alertBox: {
    margin: '16px 24px 0',
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 12,
    color: '#dc2626',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  body: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  viewContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 18,
  },
  photoBoxContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  badgeActive: {
    position: 'absolute',
    top: 10,
    zIndex: 2,
    background: '#059669',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 20,
    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.3)',
    letterSpacing: '0.02em',
  },
  badgeNew: {
    position: 'absolute',
    top: 10,
    zIndex: 2,
    background: '#2563eb',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 20,
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
    letterSpacing: '0.02em',
  },
  imageFrame: {
    width: 220,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    border: '4px solid #f1f5f9',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  fileInfoText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    fontFamily: "'IBM Plex Mono', monospace",
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 1.4,
  },
  emptyPhotoBox: {
    padding: '36px 20px',
    borderRadius: 16,
    background: '#f8fafc',
    border: '2px dashed #cbd5e1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    width: '100%',
  },
  emptyAvatar: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#334155',
    margin: '0 0 6px',
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748b',
    margin: 0,
    maxWidth: 300,
    lineHeight: 1.4,
  },
  actionButtonGroup: {
    display: 'flex',
    gap: 10,
    width: '100%',
  },
  primaryActionBtn: {
    flex: 1,
    padding: '11px 14px',
    background: '#1e5a8a',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(30, 90, 138, 0.25)',
  },
  secondaryActionBtn: {
    flex: 1,
    padding: '11px 14px',
    background: '#ffffff',
    color: '#334155',
    border: '1.5px solid #cbd5e1',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  newPhotoActions: {
    marginTop: 10,
    display: 'flex',
    gap: 10,
  },
  cancelNewBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 6,
  },
  cameraContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  cameraViewfinder: {
    position: 'relative',
    width: '100%',
    height: 280,
    background: '#090d16',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
  },
  cameraOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 10,
  },
  cameraOverlayError: {
    position: 'absolute',
    inset: 0,
    background: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    textAlign: 'center',
    zIndex: 10,
  },
  cameraErrorText: {
    color: '#fecaca',
    fontSize: 12,
    margin: '8px 0 0',
    maxWidth: 280,
    lineHeight: 1.4,
  },
  retryBtn: {
    padding: '7px 14px',
    background: '#1e5a8a',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  altBtn: {
    padding: '7px 14px',
    background: 'rgba(255,255,255,0.15)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  faceOvalWrapper: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 5,
  },
  faceOval: {
    width: 140,
    height: 190,
    borderRadius: '50%',
    border: '2px dashed rgba(52, 211, 153, 0.9)',
    boxShadow: '0 0 24px rgba(52, 211, 153, 0.35)',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  faceOvalBadge: {
    marginTop: -12,
    background: '#10b981',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 10px',
    borderRadius: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  cameraControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 0',
  },
  cameraCancelBtn: {
    padding: '8px 14px',
    background: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  cameraCaptureBtn: {
    padding: '10px 22px',
    background: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
  },
  cameraSwitchBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#f1f5f9',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  dropzone: {
    border: '2px dashed #cbd5e1',
    borderRadius: 16,
    padding: '36px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    background: '#f8fafc',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  dropzoneActive: {
    borderColor: '#1e5a8a',
    background: 'rgba(30, 90, 138, 0.05)',
  },
  dropzoneIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: '#e0f2fe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dropzoneTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1e293b',
    margin: '0 0 4px',
  },
  dropzoneSubtitle: {
    fontSize: 12,
    color: '#64748b',
    margin: '0 0 16px',
  },
  dropzoneBtn: {
    padding: '8px 18px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 600,
    color: '#334155',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #eef2f6',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    cursor: 'pointer',
  },
  modalSaveBtn: {
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 700,
    color: '#ffffff',
    background: '#1e5a8a',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 2px 8px rgba(30, 90, 138, 0.25)',
  },
  spinnerMini: {
    width: 14,
    height: 14,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
};
