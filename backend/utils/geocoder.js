const axios = require('axios');

/**
 * Geocoder Utility untuk Reverse Geocoding koordinat GPS ke detail alamat Indonesia:
 * jalan, nomor, RT, RW, kelurahan, kecamatan, kabupaten, provinsi, dan alamat lengkap.
 */
const geocoder = {
  /**
   * Reverse geocoding latitude dan longitude ke komponen alamat
   * @param {number|string} latitude
   * @param {number|string} longitude
   * @returns {Promise<object>}
   */
  reverseGeocode: async (latitude, longitude) => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return {
        alamat: null,
        jalan: null,
        nomor: null,
        rt: null,
        rw: null,
        kelurahan: null,
        kecamatan: null,
        kabupaten: null,
        provinsi: null,
      };
    }

    try {
      // Panggil OpenStreetMap Nominatim API dengan bahasa Indonesia
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          format: 'json',
          lat: lat,
          lon: lon,
          addressdetails: 1,
          'accept-language': 'id',
        },
        headers: {
          'User-Agent': 'AbsensiApp/1.0 (contact@absensi.local)',
        },
        timeout: 5000, // 5 detik timeout agar tidak memperlambat absensi
      });

      if (response.data && response.data.address) {
        const addr = response.data.address;
        const displayName = response.data.display_name || '';

        // Ekstraksi jalan
        const jalan = addr.road || addr.pedestrian || addr.street || addr.residential || addr.path || null;

        // Ekstraksi nomor rumah / bangunan
        const nomor = addr.house_number || null;

        // Ekstraksi RT dan RW dari display_name atau road jika ada
        let rt = null;
        let rw = null;
        const rtMatch = displayName.match(/rt\.?\s*(\d+)/i) || displayName.match(/rt\s*(\d+)/i);
        if (rtMatch) rt = rtMatch[1];
        const rwMatch = displayName.match(/rw\.?\s*(\d+)/i) || displayName.match(/rw\s*(\d+)/i);
        if (rwMatch) rw = rwMatch[1];

        // Kelurahan / Desa
        const kelurahan = addr.village || addr.suburb || addr.quarter || addr.neighbourhood || addr.hamlet || null;

        // Kecamatan
        const kecamatan = addr.city_district || addr.subdistrict || addr.municipality || null;

        // Kabupaten / Kota
        const kabupaten = addr.city || addr.regency || addr.county || addr.town || null;

        // Provinsi
        const provinsi = addr.state || addr.province || addr.region || null;

        // Susun alamat terformat rapi sesuai komponen yang ada
        const parts = [];
        if (jalan) {
          parts.push(nomor ? `Jl. ${jalan} No. ${nomor}` : `Jl. ${jalan}`);
        }
        if (rt || rw) {
          parts.push(`RT ${rt || '-'}/RW ${rw || '-'}`);
        }
        if (kelurahan) parts.push(`Kel. ${kelurahan}`);
        if (kecamatan) parts.push(`Kec. ${kecamatan}`);
        if (kabupaten) parts.push(kabupaten);
        if (provinsi) parts.push(`Prov. ${provinsi}`);

        const alamatFormatted = parts.length > 0 ? parts.join(', ') : displayName;

        return {
          alamat: alamatFormatted || displayName,
          jalan: jalan,
          nomor: nomor,
          rt: rt,
          rw: rw,
          kelurahan: kelurahan,
          kecamatan: kecamatan,
          kabupaten: kabupaten,
          provinsi: provinsi,
        };
      }
    } catch (err) {
      console.warn('⚠️ Reverse geocode error (nominatim):', err.message);
    }

    // Fallback jika API Nominatim gagal atau timeout
    return {
      alamat: `Koordinat: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      jalan: null,
      nomor: null,
      rt: null,
      rw: null,
      kelurahan: null,
      kecamatan: null,
      kabupaten: null,
      provinsi: null,
    };
  },
};

module.exports = geocoder;
