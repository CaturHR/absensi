const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
require('dotenv').config();

/**
 * Membandingkan dua foto wajah menggunakan Face++ Compare API.
 *
 * @param {string} imagePath1 - Path absolut foto pertama (foto master / referensi)
 * @param {string} imagePath2 - Path absolut foto kedua (foto absensi yang baru diambil)
 * @returns {Promise<{ confidence: number, thresholds: object }>}
 *   - confidence: Tingkat kemiripan wajah (0-100)
 *   - thresholds: Threshold dari Face++ (1e-3, 1e-4, 1e-5)
 * @throws {Error} Jika API gagal atau wajah tidak terdeteksi
 */
const compareFaces = async (imagePath1, imagePath2) => {
  const apiKey = process.env.FACEPP_API_KEY;
  const apiSecret = process.env.FACEPP_API_SECRET;
  const compareUrl = process.env.FACEPP_COMPARE_URL;

  // Fallback simulasi jika key belum diset atau diaktifkan untuk development/testing
  if (!apiKey || !apiSecret || process.env.MOCK_FACE_RECOGNITION === 'true') {
    if (process.env.NODE_ENV === 'development' || process.env.MOCK_FACE_RECOGNITION === 'true') {
      console.log('ℹ️ [Dev Mode] Simulasi pengenalan wajah aktif (Confidence: 94.8%).');
      return {
        confidence: 94.8,
        thresholds: {
          '1e-3': 60.0,
          '1e-4': 70.0,
          '1e-5': 80.0,
        },
      };
    }
    throw new Error('Face++ API key atau secret belum dikonfigurasi.');
  }

  const formData = new FormData();
  formData.append('api_key', apiKey);
  formData.append('api_secret', apiSecret);
  formData.append('image_file1', fs.createReadStream(imagePath1));
  formData.append('image_file2', fs.createReadStream(imagePath2));

  try {
    const response = await axios.post(compareUrl, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 30000, // 30 detik timeout
    });

    const { confidence, thresholds } = response.data;

    if (confidence === undefined) {
      throw new Error('Wajah tidak terdeteksi pada salah satu atau kedua foto.');
    }

    return {
      confidence: Math.round(confidence * 100) / 100,
      thresholds,
    };
  } catch (error) {
    // Handle Face++ specific errors
    if (error.response && error.response.data) {
      const faceError = error.response.data;
      if (faceError.error_message) {
        throw new Error(`Face++ API Error: ${faceError.error_message}`);
      }
    }
    throw new Error(`Gagal melakukan perbandingan wajah: ${error.message}`);
  }
};

module.exports = { compareFaces };
