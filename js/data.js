// ===== Dunia Awal — data & definisi =====
'use strict';

const DAY = 86400;
const YEAR_DAYS = 365;
const MAX_REAL_SECONDS = 15 * 60; // batas simulasi: 15 menit waktu nyata

const SPEEDS = [
  { id: 'hari', label: '1 Hari', desc: '1 dtk = 1 hari', f: DAY },
  { id: 'minggu', label: '1 Minggu', desc: '1 dtk = 1 minggu', f: DAY * 7 },
  { id: '2minggu', label: '2 Minggu', desc: '1 dtk = 2 minggu', f: DAY * 14 },
  { id: 'bulan', label: '1 Bulan', desc: '1 dtk = 1 bulan', f: DAY * 30.4375 },
  { id: '3bulan', label: '3 Bulan', desc: '1 dtk = 3 bulan', f: DAY * 91.3125 },
  { id: 'tahun', label: '1 Tahun', desc: '1 dtk = 1 tahun', f: DAY * 365 },
];

const SEASONS = [
  { name: 'Semi', icon: '🌱', gather: 1.0, temp: 14, rain: 0.35 },
  { name: 'Panas', icon: '☀️', gather: 1.25, temp: 26, rain: 0.18 },
  { name: 'Gugur', icon: '🍂', gather: 1.3, temp: 13, rain: 0.3 },
  { name: 'Dingin', icon: '❄️', gather: 0.55, temp: -3, rain: 0.3 },
];

// Aktivitas manusia
const ACTS = {
  kumpul: { name: 'mengumpulkan makanan', icon: '🧺' },
  buru: { name: 'berburu', icon: '🏹' },
  ikan: { name: 'memancing / melaut', icon: '🎣' },
  tani: { name: 'bertani', icon: '🌾' },
  ternak: { name: 'menggembala', icon: '🐐' },
  kriya: { name: 'membuat & memperbaiki alat', icon: '🔨' },
  bangun: { name: 'membangun', icon: '🛖' },
  jelajah: { name: 'menjelajah & bereksperimen', icon: '🧭' },
  riset: { name: 'meneliti & bereksperimen', icon: '🧪' },
  seni: { name: 'berkarya seni', icon: '🎨' },
  sosial: { name: 'bercengkerama & berdagang', icon: '💬' },
  asuh: { name: 'mengasuh & merawat', icon: '🍼' },
  ajar: { name: 'mengajar', icon: '📜' },
  istirahat: { name: 'beristirahat', icon: '💤' },
  main: { name: 'bermain', icon: '🪁' },
  tidur: { name: 'tidur', icon: '🌙' },
};

// Pohon teknologi. Penemuan = akumulasi usaha (eksperimen orang-orang) hingga mencapai `cost`.
// `yr` = target kasar tahun penemuan (dipakai untuk kalibrasi biaya).
const T_ = (id, name, icon, pre, ctx, yr, story, extra = {}) => ({ id, name, icon, pre, ctx, yr, story, ...extra });
const RS = ['riset'];
const TECHS = [
  T_('batu_tajam', 'Batu Tajam', '🪨', [], ['kriya', 'kumpul', 'jelajah'], 0.5, n => `${n} memukulkan dua batu dan mendapati serpihannya sangat tajam. Alat potong pertama tercipta!`),
  T_('tongkat', 'Tongkat Penggali', '🦯', [], ['kumpul', 'jelajah'], 0.7, n => `${n} meruncingkan sebatang kayu untuk menggali umbi-umbian. Mencari makan jadi lebih mudah.`),
  T_('berteduh', 'Gubuk Daun', '🛖', [], ['bangun', 'jelajah', 'istirahat'], 1.5, n => `${n} menyandarkan dahan dan dedaunan menjadi tempat berteduh dari hujan dan angin.`),
  T_('bahasa', 'Bahasa Lisan', '🗣️', [], ['sosial', 'asuh'], 3, n => `${n} mulai memberi nama pada benda-benda di sekitarnya. Kata-kata pertama lahir dan bahasa pun berkembang.`),
  T_('api', 'Api', '🔥', ['batu_tajam'], ['kriya', 'jelajah'], 6, n => `${n} berhasil menyalakan api sendiri! Malam kini hangat dan terang, binatang buas menjauh.`),
  T_('keranjang', 'Keranjang Anyaman', '🧺', [], ['kumpul', 'kriya', 'seni'], 8, n => `${n} menganyam rumput dan rotan menjadi keranjang. Hasil panen buah bisa dibawa lebih banyak.`),
  T_('tombak', 'Tombak', '🔱', ['batu_tajam', 'tongkat'], ['kriya', 'buru', 'jelajah'], 10, n => `${n} mengikat batu tajam di ujung tongkat. Tombak pertama membuat perburuan jauh lebih berhasil.`),
  T_('memasak', 'Memasak', '🍖', ['api'], ['kriya', 'kumpul', 'buru'], 10, n => `${n} tak sengaja menjatuhkan daging ke api — rasanya lezat dan lebih aman dimakan. Penyakit berkurang.`),
  T_('pakaian', 'Pakaian Kulit', '🧥', ['batu_tajam'], ['kriya', 'buru'], 12, n => `${n} menguliti hasil buruan dan membungkus tubuhnya. Musim dingin tak lagi begitu menakutkan.`),
  T_('obat_herbal', 'Obat Herbal', '🌿', [], ['kumpul', 'jelajah', 'asuh'], 15, n => `${n} memperhatikan daun tertentu meredakan demam. Pengetahuan obat herbal pun dimulai.`),
  T_('musik', 'Musik & Tarian', '🥁', [], ['seni', 'sosial'], 18, n => `${n} memukul batang kayu berirama dan semua orang mulai menari. Musik pertama terdengar di dunia.`),
  T_('kapak', 'Kapak Batu', '🪓', ['batu_tajam', 'tongkat'], ['kriya', 'bangun'], 20, n => `${n} membuat kapak batu bergagang. Menebang pohon dan membangun jadi lebih cepat.`),
  T_('pemakaman', 'Ritual & Kepercayaan', '🕯️', ['bahasa'], ['sosial', 'seni', 'asuh'], 25, n => `${n} memimpin upacara perpisahan untuk yang telah tiada. Manusia mulai bertanya tentang makna hidup dan mati.`, { needDeath: true }),
  T_('kail', 'Kail & Tali', '🪝', ['batu_tajam'], ['kumpul', 'jelajah', 'kriya'], 25, n => `${n} memilin serat menjadi tali dan mengukir tulang menjadi kail. Ikan di sungai kini bisa ditangkap.`),
  T_('seni_gua', 'Lukisan Dinding', '🖌️', ['api'], ['seni'], 30, n => `${n} menggambar rusa dan manusia di dinding batu dengan arang. Kisah mulai diabadikan.`),
  T_('busur', 'Busur & Panah', '🏹', ['tombak', 'kail'], ['kriya', 'buru'], 60, n => `${n} melenturkan dahan dengan tali dan melesatkan ranting runcing. Busur & panah lahir!`),
  T_('jala', 'Jala Ikan', '🕸️', ['kail', 'keranjang'], ['ikan', 'kriya'], 70, n => `${n} menganyam tali menjadi jaring. Satu kali tebar, puluhan ikan tertangkap.`),
  T_('perahu', 'Rakit & Perahu', '🛶', ['kapak'], ['ikan', 'bangun', 'jelajah'], 80, n => `${n} mengikat batang-batang kayu menjadi rakit dan menyeberangi sungai untuk pertama kali.`),
  T_('gerabah', 'Gerabah', '🏺', ['api', 'memasak'], ['kriya', 'seni', 'kumpul'], 110, n => `${n} membentuk tanah liat lalu membakarnya. Wadah gerabah membuat makanan awet lebih lama.`),
  T_('rumah_kayu', 'Rumah Kayu', '🏠', ['kapak', 'berteduh'], ['bangun'], 130, n => `${n} membangun rumah dari kayu gelondongan yang kokoh dan hangat.`),
  T_('domestikasi', 'Domestikasi Hewan', '🐐', ['tombak'], ['buru', 'kumpul'], 150, n => `${n} memelihara anak kambing yang ditinggal induknya. Hewan ternak pertama hidup bersama manusia.`, { minPop: 12 }),
  T_('pertanian', 'Pertanian', '🌾', ['tongkat', 'keranjang'], ['kumpul', 'jelajah'], 160, n => `${n} memperhatikan biji yang dibuang tumbuh menjadi tanaman, lalu sengaja menanamnya. Revolusi pertanian dimulai!`, { minPop: 12 }),
  T_('lumbung', 'Lumbung', '🏚️', ['pertanian', 'gerabah'], ['tani', 'bangun'], 210, n => `${n} membangun lumbung untuk menyimpan hasil panen. Musim dingin kini bisa dilalui tanpa kelaparan.`),
  T_('tenun', 'Tenun Kain', '🧶', ['pertanian', 'keranjang'], ['kriya', 'seni', 'tani'], 230, n => `${n} menenun serat tanaman menjadi kain. Pakaian jadi ringan, indah, dan berwarna.`),
  T_('kalender', 'Kalender Musim', '📅', ['pertanian', 'bahasa'], ['tani', 'jelajah', 'seni'], 260, n => `${n} menghitung pergantian bulan dan musim, lalu menandainya di batu. Waktu tanam kini bisa diperkirakan.`),
  T_('irigasi', 'Irigasi', '💧', ['pertanian', 'kapak'], ['tani'], 290, n => `${n} menggali parit dari sungai ke ladang. Tanaman tetap subur meski kemarau.`),
  T_('bajak', 'Bajak', '🐂', ['pertanian', 'domestikasi'], ['tani', 'ternak'], 300, n => `${n} mengikatkan alat penggaruk ke kerbau. Ladang yang luas bisa diolah dalam sehari.`),
  T_('berhitung', 'Berhitung', '🔢', ['bahasa', 'kalender'], ['ternak', 'tani', 'sosial', 'ajar'], 310, n => `${n} menggunakan simpul tali untuk menghitung ternak dan hasil panen. Matematika pertama lahir.`),
  T_('roda', 'Roda', '☸️', ['gerabah', 'kapak'], ['kriya', 'ternak'], 360, n => `${n} memperhatikan batang kayu menggelinding dan menciptakan roda. Dunia mulai bergerak lebih cepat.`, { minPop: 50 }),
  T_('tembaga', 'Peleburan Tembaga', '🟠', ['gerabah'], ['kriya', 'jelajah'], 400, n => `${n} melihat batu kehijauan meleleh di tungku gerabah. Logam pertama, tembaga, berhasil dilebur!`, { minPop: 70 }),
  T_('hukum', 'Hukum & Kepemimpinan', '⚖️', ['bahasa', 'pemakaman'], ['sosial'], 420, n => `${n} mengumpulkan para tetua dan menyepakati aturan bersama. Lahirlah hukum dan pemimpin.`, { minPop: 70 }),
  T_('gerobak', 'Gerobak', '🛒', ['roda', 'domestikasi'], ['kriya', 'ternak'], 430, n => `${n} memasang roda pada peti kayu dan menariknya dengan kuda. Barang berat mudah dipindahkan.`),
  T_('rumah_batu', 'Rumah Batu', '🏛️', ['rumah_kayu', 'berhitung'], ['bangun'], 470, n => `${n} menyusun batu dengan perhitungan cermat. Rumah batu pertama berdiri tegak.`),
  T_('perunggu', 'Perunggu', '🥉', ['tembaga'], ['kriya'], 500, n => `${n} mencampur tembaga dengan timah dan mendapat logam yang jauh lebih keras: perunggu.`, { minPop: 120 }),
  T_('tulisan', 'Tulisan', '✍️', ['berhitung', 'seni_gua'], ['ajar', 'seni', 'sosial'], 560, n => `${n} menciptakan lambang-lambang untuk setiap bunyi kata. Tulisan lahir — pengetahuan tak lagi hilang ditelan waktu.`, { minPop: 150 }),
  T_('mata_uang', 'Mata Uang & Perdagangan', '💰', ['berhitung', 'tembaga'], ['sosial', 'ternak', 'tani'], 600, n => `${n} mencetak keping tembaga sebagai alat tukar. Perdagangan antardesa berkembang pesat.`),
  T_('kincir', 'Kincir Air', '🎡', ['roda', 'irigasi'], ['tani', 'kriya'], 620, n => `${n} membangun kincir yang diputar arus sungai. Tenaga alam mulai dimanfaatkan.`),
  T_('astronomi', 'Astronomi', '🌌', ['kalender', 'berhitung'], ['jelajah', 'ajar', 'riset'], 660, n => `${n} memetakan gerak bintang dan bulan setiap malam. Langit kini bisa dibaca.`),
  T_('besi', 'Pandai Besi', '⚒️', ['perunggu'], ['kriya'], 680, n => `${n} memanaskan batu besi dengan api yang sangat panas lalu menempanya. Zaman Besi dimulai!`, { minPop: 180 }),
  T_('pengobatan', 'Ilmu Pengobatan', '⚕️', ['obat_herbal', 'tulisan'], ['asuh', 'ajar', 'riset'], 720, n => `${n} mencatat ramuan dan cara merawat orang sakit. Ilmu pengobatan lahir dan nyawa terselamatkan.`),
  T_('kertas', 'Kertas', '📄', ['tulisan', 'tenun'], ['kriya', 'ajar', 'riset'], 780, n => `${n} menumbuk serat kayu menjadi lembaran tipis. Kertas membuat ilmu mudah dicatat dan disebarkan.`),
  T_('lengkung', 'Lengkung & Jembatan', '🌉', ['rumah_batu', 'berhitung'], ['bangun', 'riset'], 820, n => `${n} menemukan bahwa batu yang disusun melengkung bisa menahan beban besar. Jembatan pertama membentang di atas sungai.`),
  T_('kaca', 'Kaca', '🪟', ['gerabah', 'tembaga'], ['kriya', 'riset'], 850, n => `${n} melelehkan pasir di tungku yang sangat panas dan mendapat benda bening: kaca.`),
  T_('kincir_angin', 'Kincir Angin', '🌬️', ['kincir'], ['tani', 'kriya'], 900, n => `${n} memasang layar pada roda kincir dan membiarkan angin menggilingkan gandum.`),
  T_('kompas', 'Kompas', '🧭', ['besi', 'astronomi'], ['jelajah', 'riset', 'ikan'], 920, n => `${n} melihat jarum besi bermagnet selalu menunjuk ke arah yang sama. Kompas pun lahir.`),
  T_('kapal_layar', 'Kapal Layar', '⛵', ['perahu', 'tenun', 'kompas'], ['ikan', 'jelajah', 'bangun'], 980, n => `${n} membangun kapal berlayar besar. Danau dan sungai dijelajahi lebih jauh dari sebelumnya.`),
  T_('jam', 'Jam Mekanik', '🕰️', ['roda', 'besi', 'astronomi'], ['kriya', 'riset'], 1060, n => `${n} merangkai roda gigi yang berdetak teratur. Waktu kini bisa diukur dengan tepat.`),
  T_('lensa', 'Lensa & Kacamata', '👓', ['kaca', 'astronomi'], ['kriya', 'riset'], 1080, n => `${n} mengasah kaca hingga melengkung dan benda kecil tampak besar. Orang tua bisa membaca lagi.`),
  T_('mesiu', 'Mesiu', '💥', ['besi', 'pengobatan'], ['kriya', 'riset'], 1120, n => `${n} mencampur belerang, arang, dan sendawa — campuran itu meledak dahsyat!`),
  T_('cetak', 'Mesin Cetak', '📰', ['kertas', 'besi'], ['kriya', 'ajar', 'riset'], 1160, n => `${n} menyusun huruf-huruf logam dan mencetak buku. Ilmu menyebar ke seluruh desa.`),
  T_('teleskop', 'Teleskop', '🔭', ['lensa', 'astronomi'], ['riset', 'jelajah'], 1200, n => `${n} menyusun dua lensa dalam tabung dan melihat kawah di bulan untuk pertama kali.`),
  T_('ilmiah', 'Metode Ilmiah', '🔬', ['cetak', 'teleskop'], ['riset', 'ajar'], 1260, n => `${n} mengajarkan cara menguji gagasan dengan percobaan berulang. Ilmu pengetahuan melesat!`),
  T_('mesin_uap', 'Mesin Uap', '♨️', ['ilmiah', 'besi', 'jam'], ['kriya', 'riset'], 1350, n => `${n} memanfaatkan tekanan uap untuk menggerakkan piston. Revolusi Industri dimulai!`),
  T_('baja', 'Baja', '🏗️', ['mesin_uap'], ['kriya', 'riset'], 1390, n => `${n} meniupkan udara ke besi cair dan mendapat baja yang kuat dan lentur.`),
  T_('tekstil', 'Pabrik Tekstil', '🏭', ['mesin_uap', 'tenun'], ['kriya'], 1410, n => `${n} menggerakkan alat tenun dengan mesin uap. Pabrik pertama berdiri.`),
  T_('kereta_api', 'Kereta Api', '🚂', ['mesin_uap', 'baja'], ['kriya', 'riset', 'bangun'], 1440, n => `${n} meletakkan mesin uap di atas rel baja. Kereta api pertama menghubungkan desa-desa.`),
  T_('vaksin', 'Vaksin', '💉', ['ilmiah', 'pengobatan', 'lensa'], ['asuh', 'riset'], 1480, n => `${n} menemukan cara melatih tubuh melawan penyakit. Wabah cacar akhirnya bisa dicegah.`),
  T_('listrik', 'Listrik', '⚡', ['ilmiah', 'tembaga', 'baja'], ['riset', 'kriya'], 1520, n => `${n} menghasilkan arus listrik dari magnet yang berputar. Energi baru yang mengubah segalanya!`),
  T_('telegraf', 'Telegraf', '📠', ['listrik'], ['riset', 'sosial'], 1560, n => `${n} mengirim pesan berupa ketukan listrik lewat kabel. Kabar kini tiba dalam sekejap.`),
  T_('lampu', 'Lampu Listrik', '💡', ['listrik', 'kaca'], ['riset', 'kriya'], 1590, n => `${n} membuat kawat menyala di dalam bola kaca. Malam tak lagi gelap.`),
  T_('telepon', 'Telepon', '☎️', ['telegraf'], ['riset', 'sosial'], 1620, n => `${n} mengirim suara lewat kabel. Orang bisa berbicara dari desa yang berjauhan.`),
  T_('mesin_bakar', 'Mesin Pembakaran', '⚙️', ['baja', 'listrik'], ['kriya', 'riset'], 1650, n => `${n} membakar minyak di dalam silinder untuk menghasilkan tenaga yang besar dan ringkas.`),
  T_('mobil', 'Mobil', '🚗', ['mesin_bakar', 'roda'], ['kriya', 'riset'], 1690, n => `${n} memasang mesin pada kereta beroda. Mobil pertama melaju tanpa kuda.`),
  T_('radio', 'Radio', '📻', ['telepon'], RS, 1710, n => `${n} mengirim suara melalui gelombang di udara, tanpa kabel sama sekali.`),
  T_('pertanian_modern', 'Traktor & Pupuk', '🚜', ['mesin_bakar', 'bajak'], ['tani', 'riset'], 1720, n => `${n} menciptakan traktor dan pupuk. Satu petani kini bisa memberi makan puluhan orang.`),
  T_('pesawat', 'Pesawat Terbang', '✈️', ['mesin_bakar'], ['riset', 'jelajah'], 1730, n => `${n} terbang dengan mesin bersayap! Mimpi manusia terbang seperti burung akhirnya terwujud.`),
  T_('antibiotik', 'Antibiotik', '💊', ['vaksin'], ['asuh', 'riset'], 1760, n => `${n} menemukan jamur yang membunuh kuman. Infeksi yang dulu mematikan kini bisa disembuhkan.`),
  T_('komputer', 'Komputer', '💻', ['listrik', 'radio', 'berhitung'], RS, 1880, n => `${n} membangun mesin yang bisa berhitung jutaan kali lebih cepat dari manusia. Komputer pertama lahir!`),
  T_('roket', 'Roket', '🚀', ['mesin_bakar', 'pesawat'], RS, 1900, n => `${n} meluncurkan roket yang menembus awan dan melampaui langit.`),
  T_('satelit', 'Satelit', '🛰️', ['roket', 'komputer', 'radio'], RS, 1980, n => `${n} menempatkan satelit di orbit. Kini dunia bisa dilihat utuh dari langit.`),
  T_('bulan', 'Pendaratan di Bulan', '🌕', ['roket', 'komputer'], RS, 2010, n => `${n} memimpin misi yang mendarat di bulan yang selama ribuan tahun hanya dipandangi dari bawah!`),
  T_('internet', 'Internet', '🌐', ['komputer', 'telepon', 'satelit'], ['riset', 'sosial'], 2030, n => `${n} menghubungkan semua komputer di dunia. Pengetahuan seluruh umat manusia kini terhubung.`),
  T_('ponsel', 'Telepon Genggam', '📱', ['internet'], ['riset', 'sosial'], 2070, n => `${n} memasukkan telepon dan komputer ke dalam genggaman tangan.`),
  T_('surya', 'Energi Surya', '🔆', ['listrik', 'komputer'], ['riset', 'kriya'], 2080, n => `${n} mengubah cahaya matahari langsung menjadi listrik. Energi bersih untuk semua.`),
  T_('ai', 'Kecerdasan Buatan', '🤖', ['internet', 'komputer'], RS, 2180, n => `${n} menciptakan mesin yang bisa belajar dan berpikir. Sebuah babak baru dalam sejarah dunia!`),
];
TECHS.forEach((t, i) => (t.idx = i));
const TECH = Object.fromEntries(TECHS.map(t => [t.id, t]));
// Biaya usaha (hasil kalibrasi) tiap penemuan
const TECH_COST = {"batu_tajam":69, "tongkat":96, "berteduh":72, "bahasa":133, "api":244, "keranjang":1058, "tombak":1351, "memasak":186, "pakaian":1862, "obat_herbal":2729, "musik":801, "kapak":856, "pemakaman":1303, "kail":5757, "seni_gua":1064, "busur":15683, "jala":16019, "perahu":7657, "gerabah":37904, "rumah_kayu":4878, "domestikasi":92983, "pertanian":64881, "lumbung":49946, "tenun":89294, "kalender":150075, "irigasi":171215, "bajak":273173, "berhitung":155649, "roda":425178, "tembaga":248000, "hukum":77586, "gerobak":308924, "rumah_batu":48968, "perunggu":48602, "tulisan":338634, "mata_uang":642381, "kincir":833041, "astronomi":418281, "besi":60872, "pengobatan":128661, "kertas":139480, "lengkung":138575, "kaca":289901, "kincir_angin":1147735, "kompas":213023, "kapal_layar":89897, "jam":140920, "lensa":76497, "mesiu":169567, "cetak":220268, "teleskop":39912, "ilmiah":19956, "mesin_uap":74834, "baja":33260, "tekstil":49889, "kereta_api":41575, "vaksin":182928, "listrik":108094, "telegraf":33260, "lampu":58205, "telepon":49889, "mesin_bakar":108094, "mobil":33260, "radio":106534, "pertanian_modern":58205, "pesawat":66519, "antibiotik":644513, "komputer":957405, "roket":276363, "satelit":438000, "bulan":602250, "internet":273750, "ponsel":219000, "surya":1095000, "ai":821250};

const ERAS = [
  { id: 'paleo', name: 'Zaman Batu Tua', need: [] },
  { id: 'meso', name: 'Zaman Batu Madya', need: ['busur', 'perahu'] },
  { id: 'neo', name: 'Zaman Batu Muda (Neolitikum)', need: ['pertanian'] },
  { id: 'cu', name: 'Zaman Tembaga', need: ['tembaga'] },
  { id: 'bronze', name: 'Zaman Perunggu', need: ['perunggu'] },
  { id: 'iron', name: 'Zaman Besi', need: ['besi'] },
  { id: 'civ', name: 'Awal Peradaban', need: ['tulisan', 'hukum', 'besi'] },
  { id: 'medieval', name: 'Abad Pertengahan', need: ['kertas', 'kompas'] },
  { id: 'renaissance', name: 'Zaman Penjelajahan', need: ['cetak', 'kapal_layar'] },
  { id: 'science', name: 'Revolusi Ilmiah', need: ['ilmiah'] },
  { id: 'industry', name: 'Revolusi Industri', need: ['mesin_uap'] },
  { id: 'electric', name: 'Zaman Listrik', need: ['listrik'] },
  { id: 'modern', name: 'Zaman Modern', need: ['mobil', 'radio'] },
  { id: 'info', name: 'Zaman Informasi', need: ['komputer'] },
  { id: 'space', name: 'Zaman Antariksa', need: ['satelit'] },
  { id: 'digital', name: 'Era Digital & Kecerdasan Buatan', need: ['internet', 'ai'] },
];

// Pekerjaan. task = aktivitas utamanya; tech = syarat penemuan; food = penghasil pangan
const JOBS = [
  { id: 'pengumpul', name: 'Pengumpul makanan', icon: '🧺', task: 'kumpul', food: true, skill: 'kumpul' },
  { id: 'pemburu', name: 'Pemburu', icon: '🏹', task: 'buru', food: true, skill: 'buru', trait: 'bra' },
  { id: 'nelayan', name: 'Nelayan', icon: '🎣', task: 'ikan', tech: 'kail', food: true, skill: 'ikan' },
  { id: 'petani', name: 'Petani', icon: '🌾', task: 'tani', tech: 'pertanian', food: true, skill: 'tani' },
  { id: 'peternak', name: 'Peternak', icon: '🐐', task: 'ternak', tech: 'domestikasi', food: true, skill: 'ternak' },
  { id: 'perajin', name: 'Perajin alat', icon: '🔨', task: 'kriya', tech: 'batu_tajam', skill: 'kriya', trait: 'cre' },
  { id: 'tukang', name: 'Tukang bangunan', icon: '🧱', task: 'bangun', tech: 'berteduh', skill: 'bangun', trait: 'str' },
  { id: 'seniman', name: 'Seniman & penyanyi', icon: '🎨', task: 'seni', tech: 'musik', skill: 'seni', trait: 'cre' },
  { id: 'tabib', name: 'Tabib', icon: '🌿', task: 'asuh', tech: 'obat_herbal', trait: 'kin', healer: true },
  { id: 'pemuka', name: 'Pemuka adat', icon: '🕯️', task: 'sosial', tech: 'pemakaman', trait: 'soc' },
  { id: 'penenun', name: 'Penenun', icon: '🧶', task: 'kriya', tech: 'tenun', skill: 'kriya', trait: 'cre' },
  { id: 'tembikar', name: 'Pembuat gerabah', icon: '🏺', task: 'kriya', tech: 'gerabah', skill: 'kriya' },
  { id: 'pandai', name: 'Pandai logam', icon: '⚒️', task: 'kriya', tech: 'tembaga', skill: 'kriya', trait: 'str' },
  { id: 'prajurit', name: 'Penjaga desa', icon: '🛡️', task: 'buru', tech: 'hukum', trait: 'bra' },
  { id: 'pedagang', name: 'Pedagang', icon: '💰', task: 'sosial', tech: 'mata_uang', trait: 'soc', trader: true },
  { id: 'juru_tulis', name: 'Juru tulis', icon: '✍️', task: 'ajar', tech: 'tulisan', trait: 'cur' },
  { id: 'guru', name: 'Guru', icon: '📚', task: 'ajar', tech: 'tulisan', trait: 'kin', teacher: true },
  { id: 'filsuf', name: 'Pemikir & filsuf', icon: '📜', task: 'riset', tech: 'tulisan', trait: 'cur', research: 2 },
  { id: 'pelaut', name: 'Pelaut', icon: '⛵', task: 'ikan', tech: 'kapal_layar', food: true, skill: 'ikan', trait: 'bra' },
  { id: 'dokter', name: 'Dokter', icon: '⚕️', task: 'asuh', tech: 'pengobatan', trait: 'kin', healer: true },
  { id: 'ilmuwan', name: 'Ilmuwan', icon: '🔬', task: 'riset', tech: 'ilmiah', trait: 'cur', research: 3 },
  { id: 'insinyur', name: 'Insinyur', icon: '📐', task: 'bangun', tech: 'mesin_uap', trait: 'cre', research: 1.5 },
  { id: 'buruh', name: 'Buruh pabrik', icon: '🏭', task: 'kriya', tech: 'tekstil', trait: 'str' },
  { id: 'masinis', name: 'Masinis kereta', icon: '🚂', task: 'sosial', tech: 'kereta_api', trait: 'bra', trader: true },
  { id: 'teknisi', name: 'Teknisi listrik', icon: '⚡', task: 'kriya', tech: 'listrik', trait: 'cre' },
  { id: 'sopir', name: 'Sopir', icon: '🚗', task: 'sosial', tech: 'mobil', trader: true },
  { id: 'pilot', name: 'Pilot', icon: '✈️', task: 'jelajah', tech: 'pesawat', trait: 'bra' },
  { id: 'programmer', name: 'Programmer', icon: '💻', task: 'riset', tech: 'komputer', trait: 'cur', research: 3 },
  { id: 'astronot', name: 'Astronot', icon: '🧑‍🚀', task: 'riset', tech: 'roket', trait: 'bra', research: 2 },
];
const JOB = Object.fromEntries(JOBS.map(j => [j.id, j]));

const RESEARCH_FAIL = [
  'percobaannya gagal lagi, tapi ia mencatat apa yang salah', 'hampir berhasil — namun hasilnya hancur di saat terakhir',
  'menghabiskan berminggu-minggu tanpa hasil, tapi tidak menyerah', 'mendapat ide baru dari kegagalan kemarin',
  'ditertawakan tetangganya, namun tetap tekun bereksperimen', 'mengulang percobaan untuk yang keseratus kalinya',
  'berdiskusi panjang dengan para tetua tentang caranya', 'melihat sedikit tanda keberhasilan dan makin bersemangat',
];

// Alat. act = aktivitas yang memakainya; wear = keausan per hari pakai
const TOOLS = [
  { id: 'pisau', name: 'pisau', tech: 'batu_tajam', act: ['kriya', 'buru', 'kumpul', 'bangun'], wear: 1.2, bonus: 0.1 },
  { id: 'tongkat', name: 'tongkat penggali', tech: 'tongkat', act: ['kumpul'], wear: 1.5, bonus: 0.25 },
  { id: 'keranjang', name: 'keranjang', tech: 'keranjang', act: ['kumpul'], wear: 1.4, bonus: 0.3 },
  { id: 'tombak', name: 'tombak', tech: 'tombak', act: ['buru'], wear: 2.4, bonus: 0.6 },
  { id: 'busur', name: 'busur', tech: 'busur', act: ['buru'], wear: 2.0, bonus: 0.7 },
  { id: 'kail', name: 'kail', tech: 'kail', act: ['ikan'], wear: 2.2, bonus: 0.8 },
  { id: 'jala', name: 'jala', tech: 'jala', act: ['ikan'], wear: 1.6, bonus: 0.8 },
  { id: 'kapak', name: 'kapak', tech: 'kapak', act: ['bangun', 'kriya'], wear: 1.8, bonus: 0.5 },
  { id: 'cangkul', name: 'cangkul', tech: 'pertanian', act: ['tani'], wear: 1.5, bonus: 0.3 },
  { id: 'bajak', name: 'bajak', tech: 'bajak', act: ['tani'], wear: 1.0, bonus: 0.6 },
];
const MATERIAL = () => (S.tech.has('baja') ? ['baja', 0.25] : S.tech.has('besi') ? ['besi', 0.35] : S.tech.has('perunggu') ? ['perunggu', 0.5] : S.tech.has('tembaga') ? ['tembaga', 0.7] : ['', 1]);

// Spesies hewan
const SPECIES = [
  { id: 'rusa', name: 'Rusa', emoji: '🦌', biomes: [5, 4, 9], cap: 45, meat: 6, danger: 0.1, speed: 26 },
  { id: 'kelinci', name: 'Kelinci', emoji: '🐇', biomes: [4, 9], cap: 50, meat: 1.5, danger: 0, speed: 30 },
  { id: 'babi', name: 'Babi Hutan', emoji: '🐗', biomes: [5], cap: 26, meat: 7, danger: 0.6, speed: 20 },
  { id: 'kerbau', name: 'Kerbau Liar', emoji: '🐃', biomes: [4, 3], cap: 20, meat: 12, danger: 0.5, speed: 14, dom: 'sapi' },
  { id: 'kambing', name: 'Kambing Gunung', emoji: '🐐', biomes: [6, 7], cap: 30, meat: 4, danger: 0.1, speed: 18, dom: 'kambing' },
  { id: 'kuda', name: 'Kuda Liar', emoji: '🐎', biomes: [4, 9], cap: 18, meat: 8, danger: 0.2, speed: 34, dom: 'kuda' },
  { id: 'ayam', name: 'Ayam Hutan', emoji: '🐓', biomes: [5, 4], cap: 30, meat: 1, danger: 0, speed: 14, dom: 'ayam' },
  { id: 'gajah', name: 'Gajah', emoji: '🐘', biomes: [4, 5], cap: 7, meat: 30, danger: 0.6, speed: 12 },
  { id: 'serigala', name: 'Serigala', emoji: '🐺', biomes: [5, 6], cap: 12, meat: 3, danger: 0.7, speed: 30, pred: true },
  { id: 'harimau', name: 'Harimau', emoji: '🐅', biomes: [5], cap: 5, meat: 5, danger: 1, speed: 28, pred: true },
  { id: 'beruang', name: 'Beruang', emoji: '🐻', biomes: [5, 6, 7], cap: 5, meat: 10, danger: 0.9, speed: 16, pred: true },
  { id: 'ikan', name: 'Ikan', emoji: '🐟', biomes: [1, 2], cap: 50, meat: 1, danger: 0, speed: 16, water: true },
  { id: 'burung', name: 'Burung', emoji: '🐦', biomes: [4, 5, 9, 6], cap: 36, meat: 0.5, danger: 0, speed: 60, fly: true },
];
const SPEC = Object.fromEntries(SPECIES.map(s => [s.id, s]));
const DOMESTIC = { kambing: '🐐', sapi: '🐄', ayam: '🐔', kuda: '🐴' };

const DISEASES = [
  { name: 'demam', sev: 0.5, dur: 6 },
  { name: 'flu', sev: 0.35, dur: 7, cold: true },
  { name: 'diare', sev: 0.7, dur: 5, dirty: true },
  { name: 'infeksi luka', sev: 0.8, dur: 10 },
  { name: 'radang paru', sev: 1.3, dur: 14, cold: true },
  { name: 'cacar', sev: 1.6, dur: 12, crowd: true },
  { name: 'wabah demam berdarah', sev: 1.4, dur: 10, crowd: true },
];

const CAUSES = {
  tua: 'usia tua', penyakit: 'penyakit', bayi: 'sakit saat bayi', lapar: 'kelaparan', melahirkan: 'saat melahirkan',
  buas: 'serangan hewan buas', celaka: 'kecelakaan', tenggelam: 'tenggelam', dingin: 'kedinginan',
  bencana: 'bencana alam', tikai: 'pertikaian',
};

// ===== pembangkit nama =====
const SYL_A = ['Ka', 'Ha', 'Sa', 'Na', 'Ra', 'La', 'Ma', 'Ta', 'Ya', 'Za', 'Ba', 'Da', 'Ar', 'Il', 'Um', 'Es', 'Ni', 'Si', 'Lu', 'Mi', 'Ru', 'Ke', 'Te', 'Sy', 'No', 'Ad', 'Ir', 'Ze', 'Ki', 'Ba'];
const SYL_M = ['bi', 'ra', 'na', 'li', 'ma', 'ri', 'da', 'ki', 'sa', 'la', 'ru', 'mi', 'ta', 'ni', 'ba', 'yo', 'di'];
const END_L = ['l', 'n', 'r', 'm', 'k', 'th', 's', 'f', 'b', 'd'];
const END_P = ['a', 'ah', 'i', 'ya', 'na', 'la', 'ra', 'sa', 'ti'];
function genName(sex, rnd) {
  const n = rnd() < 0.55 ? 2 : 1;
  let s = SYL_A[(rnd() * SYL_A.length) | 0];
  for (let i = 1; i < n; i++) s += SYL_M[(rnd() * SYL_M.length) | 0];
  s += sex === 'L' ? END_L[(rnd() * END_L.length) | 0] : END_P[(rnd() * END_P.length) | 0];
  return s;
}
const VIL_A = ['Lembah', 'Bukit', 'Tepi', 'Padang', 'Hutan', 'Telaga', 'Batu', 'Sumber', 'Kaki', 'Tanjung'];
const VIL_B = ['Fajar', 'Damai', 'Hijau', 'Embun', 'Cahaya', 'Angin', 'Bintang', 'Kabut', 'Senja', 'Rusa', 'Mawar', 'Elang', 'Bulan', 'Pelangi', 'Akar'];

const WONDERS = [
  'mengapa bulan berubah bentuk setiap malam', 'mengapa air sungai selalu mengalir ke arah yang sama', 'bagaimana burung bisa terbang',
  'dari mana datangnya petir', 'mengapa bintang bergerak di langit malam', 'apa yang ada di balik puncak gunung',
  'mengapa biji yang jatuh bisa tumbuh menjadi tanaman', 'ke mana perginya matahari saat malam', 'mengapa batu tertentu lebih keras dari yang lain',
  'apa yang terjadi pada orang yang sudah meninggal', 'mengapa musim selalu berganti', 'bagaimana cara menjinakkan hewan liar',
];
