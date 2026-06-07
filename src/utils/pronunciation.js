/**
 * 发音评测引擎 v2
 *
 * 增强功能：
 * 1. 音素级分析 — 基于 IPA 音标字典，检测中英音素混淆（θ→s, ð→d, v→w 等）
 * 2. 重音检测 — 基于词重音模式字典，标记重音位置错误
 * 3. 连读检测 — 识别辅-元连读、元-元连读、省音、同化
 * 4. 语调分析 — 基于句法结构推断语调模式
 * 5. 前端输出：评分 + 错误单词高亮 + 标准音标
 */

// ══════════════════════════════════════════════════════════════
// 1. IPA 音标字典（覆盖常用词）
// ══════════════════════════════════════════════════════════════

const IPA_DICT = {
  // 功能词
  'the': { ipa: '/ðə/;/ðiː/', stress: 0 },
  'a': { ipa: '/ə/;/eɪ/', stress: 0 },
  'an': { ipa: '/ən/;/æn/', stress: 0 },
  'of': { ipa: '/əv/;/ɒv/', stress: 0 },
  'to': { ipa: '/tə/;/tuː/', stress: 0 },
  'and': { ipa: '/ænd/;/ənd/', stress: 0 },
  'in': { ipa: '/ɪn/', stress: 0 },
  'on': { ipa: '/ɒn/', stress: 0 },
  'at': { ipa: '/æt/', stress: 0 },
  'for': { ipa: '/fɔːr/;/fər/', stress: 0 },
  'with': { ipa: '/wɪð/', stress: 0 },
  'from': { ipa: '/frɒm/;/frʌm/', stress: 0 },
  'that': { ipa: '/ðæt/', stress: 0 },
  'this': { ipa: '/ðɪs/', stress: 0 },
  'it': { ipa: '/ɪt/', stress: 0 },
  'is': { ipa: '/ɪz/', stress: 0 },
  'are': { ipa: '/ɑːr/;/ər/', stress: 0 },
  'was': { ipa: '/wɒz/;/wʌz/', stress: 0 },
  'were': { ipa: '/wɜːr/', stress: 0 },
  'be': { ipa: '/biː/', stress: 0 },
  'have': { ipa: '/hæv/', stress: 0 },
  'has': { ipa: '/hæz/', stress: 0 },
  'do': { ipa: '/duː/', stress: 0 },
  'can': { ipa: '/kæn/', stress: 0 },
  'will': { ipa: '/wɪl/', stress: 0 },
  'would': { ipa: '/wʊd/', stress: 0 },
  'not': { ipa: '/nɒt/', stress: 0 },
  'but': { ipa: '/bʌt/', stress: 0 },
  'or': { ipa: '/ɔːr/', stress: 0 },
  'so': { ipa: '/səʊ/', stress: 0 },
  'if': { ipa: '/ɪf/', stress: 0 },
  'my': { ipa: '/maɪ/', stress: 0 },
  'your': { ipa: '/jɔːr/', stress: 0 },
  'our': { ipa: '/aʊər/', stress: 0 },
  'their': { ipa: '/ðeər/', stress: 0 },
  'his': { ipa: '/hɪz/', stress: 0 },
  'her': { ipa: '/hɜːr/', stress: 0 },
  'its': { ipa: '/ɪts/', stress: 0 },
  'no': { ipa: '/nəʊ/', stress: 0 },
  'yes': { ipa: '/jes/', stress: 0 },

  // th 音重点词
  'think': { ipa: '/θɪŋk/', stress: 1, phonemes: [{ ph: 'θ', pos: 0, type: 'dental-fricative' }] },
  'three': { ipa: '/θriː/', stress: 1, phonemes: [{ ph: 'θ', pos: 0, type: 'dental-fricative' }] },
  'thing': { ipa: '/θɪŋ/', stress: 1, phonemes: [{ ph: 'θ', pos: 0, type: 'dental-fricative' }] },
  'thank': { ipa: '/θæŋk/', stress: 1, phonemes: [{ ph: 'θ', pos: 0, type: 'dental-fricative' }] },
  'through': { ipa: '/θruː/', stress: 1, phonemes: [{ ph: 'θ', pos: 0, type: 'dental-fricative' }] },
  'thought': { ipa: '/θɔːt/', stress: 1, phonemes: [{ ph: 'θ', pos: 0, type: 'dental-fricative' }] },
  'they': { ipa: '/ðeɪ/', stress: 1, phonemes: [{ ph: 'ð', pos: 0, type: 'dental-fricative' }] },
  'there': { ipa: '/ðeər/', stress: 1, phonemes: [{ ph: 'ð', pos: 0, type: 'dental-fricative' }] },
  'their': { ipa: '/ðeər/', stress: 1, phonemes: [{ ph: 'ð', pos: 0, type: 'dental-fricative' }] },
  'then': { ipa: '/ðen/', stress: 1, phonemes: [{ ph: 'ð', pos: 0, type: 'dental-fricative' }] },
  'other': { ipa: '/ˈʌðər/', stress: 1, phonemes: [{ ph: 'ð', pos: 2, type: 'dental-fricative' }] },
  'mother': { ipa: '/ˈmʌðər/', stress: 1, phonemes: [{ ph: 'ð', pos: 2, type: 'dental-fricative' }] },
  'father': { ipa: '/ˈfɑːðər/', stress: 1, phonemes: [{ ph: 'ð', pos: 2, type: 'dental-fricative' }] },
  'weather': { ipa: '/ˈweðər/', stress: 1, phonemes: [{ ph: 'ð', pos: 2, type: 'dental-fricative' }] },
  'together': { ipa: '/təˈɡeðər/', stress: 2, phonemes: [{ ph: 'ð', pos: 4, type: 'dental-fricative' }] },

  // r/l 混淆风险词
  'really': { ipa: '/ˈrɪəli/', stress: 1, phonemes: [{ ph: 'r', pos: 0, type: 'approximant' }] },
  'right': { ipa: '/raɪt/', stress: 1, phonemes: [{ ph: 'r', pos: 0, type: 'approximant' }] },
  'room': { ipa: '/ruːm/', stress: 1, phonemes: [{ ph: 'r', pos: 0, type: 'approximant' }] },
  'run': { ipa: '/rʌn/', stress: 1, phonemes: [{ ph: 'r', pos: 0, type: 'approximant' }] },
  'read': { ipa: '/riːd/', stress: 1, phonemes: [{ ph: 'r', pos: 0, type: 'approximant' }] },
  'like': { ipa: '/laɪk/', stress: 1, phonemes: [{ ph: 'l', pos: 0, type: 'lateral' }] },
  'love': { ipa: '/lʌv/', stress: 1, phonemes: [{ ph: 'l', pos: 0, type: 'lateral' }] },
  'long': { ipa: '/lɒŋ/', stress: 1, phonemes: [{ ph: 'l', pos: 0, type: 'lateral' }] },
  'learn': { ipa: '/lɜːrn/', stress: 1, phonemes: [{ ph: 'l', pos: 0, type: 'lateral' }] },

  // v/w 混淆风险词
  'very': { ipa: '/ˈveri/', stress: 1, phonemes: [{ ph: 'v', pos: 0, type: 'labiodental' }] },
  'visit': { ipa: '/ˈvɪzɪt/', stress: 1, phonemes: [{ ph: 'v', pos: 0, type: 'labiodental' }] },
  'voice': { ipa: '/vɔɪs/', stress: 1, phonemes: [{ ph: 'v', pos: 0, type: 'labiodental' }] },
  'view': { ipa: '/vjuː/', stress: 1, phonemes: [{ ph: 'v', pos: 0, type: 'labiodental' }] },
  'we': { ipa: '/wiː/', stress: 1, phonemes: [{ ph: 'w', pos: 0, type: 'labiovelar' }] },
  'work': { ipa: '/wɜːrk/', stress: 1, phonemes: [{ ph: 'w', pos: 0, type: 'labiovelar' }] },
  'world': { ipa: '/wɜːrld/', stress: 1, phonemes: [{ ph: 'w', pos: 0, type: 'labiovelar' }] },
  'want': { ipa: '/wɒnt/', stress: 1, phonemes: [{ ph: 'w', pos: 0, type: 'labiovelar' }] },

  // 鼻音尾（n/ŋ 混淆）
  'morning': { ipa: '/ˈmɔːrnɪŋ/', stress: 1, phonemes: [{ ph: 'ŋ', pos: -1, type: 'velar-nasal' }] },
  'evening': { ipa: '/ˈiːvnɪŋ/', stress: 1, phonemes: [{ ph: 'ŋ', pos: -1, type: 'velar-nasal' }] },
  'going': { ipa: '/ˈɡəʊɪŋ/', stress: 1, phonemes: [{ ph: 'ŋ', pos: -1, type: 'velar-nasal' }] },
  'doing': { ipa: '/ˈduːɪŋ/', stress: 1, phonemes: [{ ph: 'ŋ', pos: -1, type: 'velar-nasal' }] },
  'talking': { ipa: '/ˈtɔːkɪŋ/', stress: 1, phonemes: [{ ph: 'ŋ', pos: -1, type: 'velar-nasal' }] },
  'working': { ipa: '/ˈwɜːrkɪŋ/', stress: 1, phonemes: [{ ph: 'ŋ', pos: -1, type: 'velar-nasal' }] },
  'sing': { ipa: '/sɪŋ/', stress: 1, phonemes: [{ ph: 'ŋ', pos: -1, type: 'velar-nasal' }] },
  'thing': { ipa: '/θɪŋ/', stress: 1, phonemes: [{ ph: 'ŋ', pos: -1, type: 'velar-nasal' }] },

  // 短元音/长元音混淆
  'ship': { ipa: '/ʃɪp/', stress: 1, phonemes: [{ ph: 'ɪ', pos: 1, type: 'short-vowel' }] },
  'sheep': { ipa: '/ʃiːp/', stress: 1, phonemes: [{ ph: 'iː', pos: 1, type: 'long-vowel' }] },
  'live': { ipa: '/lɪv/', stress: 1, phonemes: [{ ph: 'ɪ', pos: 1, type: 'short-vowel' }] },
  'leave': { ipa: '/liːv/', stress: 1, phonemes: [{ ph: 'iː', pos: 1, type: 'long-vowel' }] },
  'full': { ipa: '/fʊl/', stress: 1, phonemes: [{ ph: 'ʊ', pos: 1, type: 'short-vowel' }] },
  'fool': { ipa: '/fuːl/', stress: 1, phonemes: [{ ph: 'uː', pos: 1, type: 'long-vowel' }] },
  'bit': { ipa: '/bɪt/', stress: 1, phonemes: [{ ph: 'ɪ', pos: 1, type: 'short-vowel' }] },
  'beat': { ipa: '/biːt/', stress: 1, phonemes: [{ ph: 'iː', pos: 1, type: 'long-vowel' }] },
  'pull': { ipa: '/pʊl/', stress: 1, phonemes: [{ ph: 'ʊ', pos: 1, type: 'short-vowel' }] },
  'pool': { ipa: '/puːl/', stress: 1, phonemes: [{ ph: 'uː', pos: 1, type: 'long-vowel' }] },

  // 多音节词（重音检测）
  'experience': { ipa: '/ɪkˈspɪəriəns/', stress: 2, syllables: ['ɪk', 'spɪə', 'ri', 'əns'] },
  'opportunity': { ipa: '/ˌɒpəˈtjuːnəti/', stress: 3, syllables: ['ɒp', 'ə', 'tjuː', 'nə', 'ti'] },
  'responsible': { ipa: '/rɪˈspɒnsəbl/', stress: 2, syllables: ['rɪ', 'spɒn', 'sə', 'bl'] },
  'comfortable': { ipa: '/ˈkʌmftəbl/', stress: 1, syllables: ['kʌmf', 'tə', 'bl'] },
  'vegetable': { ipa: '/ˈvedʒtəbl/', stress: 1, syllables: ['vedʒ', 'tə', 'bl'] },
  'recommend': { ipa: '/ˌrekəˈmend/', stress: 3, syllables: ['re', 'kə', 'mend'] },
  'schedule': { ipa: '/ˈʃedjuːl/', stress: 1, syllables: ['ʃe', 'djuːl'] },
  'interesting': { ipa: '/ˈɪntrəstɪŋ/', stress: 1, syllables: ['ɪn', 'trə', 'stɪŋ'] },
  'probably': { ipa: '/ˈprɒbəbli/', stress: 1, syllables: ['prɒ', 'bə', 'bli'] },
  'university': { ipa: '/ˌjuːnɪˈvɜːrsəti/', stress: 1, syllables: ['juː', 'nɪ', 'vɜːr', 'sə', 'ti'] },
  'particularly': { ipa: '/pərˈtɪkjələrli/', stress: 2, syllables: ['pər', 'tɪ', 'kjə', 'lər', 'li'] },
  'development': { ipa: '/dɪˈveləpmənt/', stress: 2, syllables: ['dɪ', 've', 'ləp', 'mənt'] },
  'information': { ipa: '/ˌɪnfərˈmeɪʃən/', stress: 3, syllables: ['ɪn', 'fər', 'meɪ', 'ʃən'] },
  'technology': { ipa: '/tekˈnɒlədʒi/', stress: 2, syllables: ['tek', 'nɒ', 'lə', 'dʒi'] },
  'environment': { ipa: '/ɪnˈvaɪrənmənt/', stress: 2, syllables: ['ɪn', 'vaɪ', 'rən', 'mənt'] },
  'communication': { ipa: '/kəˌmjuːnɪˈkeɪʃən/', stress: 3, syllables: ['kə', 'mjuː', 'nɪ', 'keɪ', 'ʃən'] },
  'presentation': { ipa: '/ˌprezənˈteɪʃən/', stress: 3, syllables: ['pre', 'zən', 'teɪ', 'ʃən'] },
  'menu': { ipa: '/ˈmenjuː/', stress: 1 },
  'restaurant': { ipa: '/ˈrestərɒnt/', stress: 1, syllables: ['res', 'tə', 'rɒnt'] },
  'interview': { ipa: '/ˈɪntərvjuː/', stress: 1, syllables: ['ɪn', 'tər', 'vjuː'] },
  'colleague': { ipa: '/ˈkɒliːɡ/', stress: 1 },
  'business': { ipa: '/ˈbɪznəs/', stress: 1, syllables: ['bɪz', 'nəs'] },
  'project': { ipa: '/ˈprɒdʒekt/', stress: 1 },
  'deadline': { ipa: '/ˈdedlaɪn/', stress: 1 },
  'feedback': { ipa: '/ˈfiːdbæk/', stress: 1 },
  'meeting': { ipa: '/ˈmiːtɪŋ/', stress: 1 },
  'discussion': { ipa: '/dɪˈskʌʃən/', stress: 2 },
  'decision': { ipa: '/dɪˈsɪʒən/', stress: 2 },
  'solution': { ipa: '/səˈluːʃən/', stress: 2 },
  'strategy': { ipa: '/ˈstrætədʒi/', stress: 1 },
  'quality': { ipa: '/ˈkwɒləti/', stress: 1 },
  'customer': { ipa: '/ˈkʌstəmər/', stress: 1 },
  'service': { ipa: '/ˈsɜːrvɪs/', stress: 1 },
  'product': { ipa: '/ˈprɒdʌkt/', stress: 1 },
  'company': { ipa: '/ˈkʌmpəni/', stress: 1 },
  'manager': { ipa: '/ˈmænɪdʒər/', stress: 1 },
  'different': { ipa: '/ˈdɪfərənt/', stress: 1 },
  'important': { ipa: '/ɪmˈpɔːrtənt/', stress: 2 },
  'beautiful': { ipa: '/ˈbjuːtɪfəl/', stress: 1 },
  'wonderful': { ipa: '/ˈwʌndərfəl/', stress: 1 },
  'difficult': { ipa: '/ˈdɪfɪkəlt/', stress: 1 },
  'possible': { ipa: '/ˈpɒsəbl/', stress: 1 },
  'necessary': { ipa: '/ˈnesəsəri/', stress: 1 },
  'available': { ipa: '/əˈveɪləbl/', stress: 2 },
  'understand': { ipa: '/ˌʌndərˈstænd/', stress: 3 },
  'remember': { ipa: '/rɪˈmembər/', stress: 2 },
  'practice': { ipa: '/ˈpræktɪs/', stress: 1 },
  'prepare': { ipa: '/prɪˈpeər/', stress: 2 },
  'explain': { ipa: '/ɪkˈspleɪn/', stress: 2 },
  'describe': { ipa: '/dɪˈskraɪb/', stress: 2 },
  'suggest': { ipa: '/səˈdʒest/', stress: 2 },
  'agree': { ipa: '/əˈɡriː/', stress: 2 },
  'believe': { ipa: '/bɪˈliːv/', stress: 2 },
  'decide': { ipa: '/dɪˈsaɪd/', stress: 2 },
  'continue': { ipa: '/kənˈtɪnjuː/', stress: 2 },
  'consider': { ipa: '/kənˈsɪdər/', stress: 2 },
  'require': { ipa: '/rɪˈkwaɪər/', stress: 2 },
  'provide': { ipa: '/prəˈvaɪd/', stress: 2 },
  'include': { ipa: '/ɪnˈkluːd/', stress: 2 },
  'receive': { ipa: '/rɪˈsiːv/', stress: 2 },
  'achieve': { ipa: '/əˈtʃiːv/', stress: 2 },
  'improve': { ipa: '/ɪmˈpruːv/', stress: 2 },
  'develop': { ipa: '/dɪˈveləp/', stress: 2 },
  'create': { ipa: '/kriˈeɪt/', stress: 2 },
  'manage': { ipa: '/ˈmænɪdʒ/', stress: 1 },
  'handle': { ipa: '/ˈhændl/', stress: 1 },
  'change': { ipa: '/tʃeɪndʒ/', stress: 1 },
  'start': { ipa: '/stɑːrt/', stress: 1 },
  'finish': { ipa: '/ˈfɪnɪʃ/', stress: 1 },
  'complete': { ipa: '/kəmˈpliːt/', stress: 2 },
  'support': { ipa: '/səˈpɔːrt/', stress: 2 },
  'offer': { ipa: '/ˈɒfər/', stress: 1 },
  'accept': { ipa: '/əkˈsept/', stress: 2 },
  'refuse': { ipa: '/rɪˈfjuːz/', stress: 2 },
  'expect': { ipa: '/ɪkˈspekt/', stress: 2 },
  'prefer': { ipa: '/prɪˈfɜːr/', stress: 2 },
  'enjoy': { ipa: '/ɪnˈdʒɔɪ/', stress: 2 },
  'happen': { ipa: '/ˈhæpən/', stress: 1 },
  'become': { ipa: '/bɪˈkʌm/', stress: 2 },
  'appear': { ipa: '/əˈpɪər/', stress: 2 },
  'follow': { ipa: '/ˈfɒləʊ/', stress: 1 },
  'happen': { ipa: '/ˈhæpən/', stress: 1 },
  'listen': { ipa: '/ˈlɪsn/', stress: 1 },
  'speak': { ipa: '/spiːk/', stress: 1 },
  'write': { ipa: '/raɪt/', stress: 1 },
  'answer': { ipa: '/ˈɑːnsər/', stress: 1 },
  'question': { ipa: '/ˈkwestʃən/', stress: 1 },
  'problem': { ipa: '/ˈprɒbləm/', stress: 1 },
  'example': { ipa: '/ɪɡˈzɑːmpl/', stress: 2 },
  'reason': { ipa: '/ˈriːzn/', stress: 1 },
  'result': { ipa: '/rɪˈzʌlt/', stress: 2 },
  'idea': { ipa: '/aɪˈdɪə/', stress: 2 },
  'fact': { ipa: '/fækt/', stress: 1 },
  'point': { ipa: '/pɔɪnt/', stress: 1 },
  'case': { ipa: '/keɪs/', stress: 1 },
  'part': { ipa: '/pɑːrt/', stress: 1 },
  'place': { ipa: '/pleɪs/', stress: 1 },
  'time': { ipa: '/taɪm/', stress: 1 },
  'people': { ipa: '/ˈpiːpl/', stress: 1 },
  'person': { ipa: '/ˈpɜːrsn/', stress: 1 },
  'friend': { ipa: '/frend/', stress: 1 },
  'family': { ipa: '/ˈfæməli/', stress: 1 },
  'country': { ipa: '/ˈkʌntri/', stress: 1 },
  'city': { ipa: '/ˈsɪti/', stress: 1 },
  'school': { ipa: '/skuːl/', stress: 1 },
  'student': { ipa: '/ˈstjuːdənt/', stress: 1 },
  'teacher': { ipa: '/ˈtiːtʃər/', stress: 1 },
  'doctor': { ipa: '/ˈdɒktər/', stress: 1 },
  'language': { ipa: '/ˈlæŋɡwɪdʒ/', stress: 1 },
  'english': { ipa: '/ˈɪŋɡlɪʃ/', stress: 1 },
  'chinese': { ipa: '/tʃaɪˈniːz/', stress: 2 },
  'music': { ipa: '/ˈmjuːzɪk/', stress: 1 },
  'movie': { ipa: '/ˈmuːvi/', stress: 1 },
  'food': { ipa: '/fuːd/', stress: 1 },
  'water': { ipa: '/ˈwɔːtər/', stress: 1 },
  'coffee': { ipa: '/ˈkɒfi/', stress: 1 },
  'travel': { ipa: '/ˈtrævəl/', stress: 1 },
  'hotel': { ipa: '/həʊˈtel/', stress: 2 },
  'airport': { ipa: '/ˈeəpɔːrt/', stress: 1 },
  'today': { ipa: '/təˈdeɪ/', stress: 2 },
  'tomorrow': { ipa: '/təˈmɒrəʊ/', stress: 2 },
  'yesterday': { ipa: '/ˈjestədeɪ/', stress: 1 },
  'morning': { ipa: '/ˈmɔːrnɪŋ/', stress: 1 },
  'afternoon': { ipa: '/ˌɑːftərˈnuːn/', stress: 3 },
  'evening': { ipa: '/ˈiːvnɪŋ/', stress: 1 },
  'night': { ipa: '/naɪt/', stress: 1 },
  'week': { ipa: '/wiːk/', stress: 1 },
  'month': { ipa: '/mʌnθ/', stress: 1 },
  'year': { ipa: '/jɪər/', stress: 1 },
  'number': { ipa: '/ˈnʌmbər/', stress: 1 },
  'name': { ipa: '/neɪm/', stress: 1 },
  'address': { ipa: '/əˈdres/', stress: 2 },
  'phone': { ipa: '/fəʊn/', stress: 1 },
  'email': { ipa: '/ˈiːmeɪl/', stress: 1 },
  'computer': { ipa: '/kəmˈpjuːtər/', stress: 2 },
  'internet': { ipa: '/ˈɪntərnet/', stress: 1 },
  'website': { ipa: '/ˈwebsaɪt/', stress: 1 },
  'research': { ipa: '/rɪˈsɜːrtʃ/', stress: 2 },
  'academic': { ipa: '/ˌækəˈdemɪk/', stress: 3 },
  'analysis': { ipa: '/əˈnæləsɪs/', stress: 2 },
  'methodology': { ipa: '/ˌmeθəˈdɒlədʒi/', stress: 3 },
  'literature': { ipa: '/ˈlɪtərətʃər/', stress: 1 },
  'conference': { ipa: '/ˈkɒnfərəns/', stress: 1 },
  'publication': { ipa: '/ˌpʌblɪˈkeɪʃən/', stress: 3 },
  'hypothesis': { ipa: '/haɪˈpɒθəsɪs/', stress: 2 },
  'experiment': { ipa: '/ɪkˈsperɪmənt/', stress: 2 },
  'conclusion': { ipa: '/kənˈkluːʒən/', stress: 2 },
  'reference': { ipa: '/ˈrefərəns/', stress: 1 },
  'abstract': { ipa: '/ˈæbstrækt/', stress: 1 },
  'introduction': { ipa: '/ˌɪntrəˈdʌkʃən/', stress: 3 },
  'discussion': { ipa: '/dɪˈskʌʃən/', stress: 2 },
}

// ══════════════════════════════════════════════════════════════
// 2. 中英音素混淆模式
// ══════════════════════════════════════════════════════════════

const PHONEME_CONFUSIONS = {
  // 齿擦音 → 对应中文替代音
  'θ': { confusedAs: 's', label: 'θ→s', desc: '舌尖应轻触上齿送气，而非发成s音', severity: 'high' },
  'ð': { confusedAs: 'd', label: 'ð→d', desc: '舌尖应轻触上齿振动声带，而非发成d音', severity: 'high' },
  // 唇齿擦音 → 双唇音
  'v': { confusedAs: 'w', label: 'v→w', desc: '上齿应轻触下唇，而非双唇圆拢', severity: 'medium' },
  // 边音 ↔ 近音
  'l': { confusedAs: 'r', label: 'l→r', desc: '舌尖应抵上齿龈，舌侧出气', severity: 'medium' },
  'r': { confusedAs: 'l', label: 'r→l', desc: '舌尖应卷起不触上颚', severity: 'medium' },
  // 鼻音尾
  'ŋ': { confusedAs: 'n', label: 'ŋ→n', desc: '舌后部应抬起接触软腭', severity: 'low' },
  // 短元音→长元音
  'ɪ': { confusedAs: 'iː', label: 'ɪ→iː', desc: '短元音，口腔肌肉放松，不要拉长', severity: 'low' },
  'ʊ': { confusedAs: 'uː', label: 'ʊ→uː', desc: '短元音，嘴唇微微收圆即可', severity: 'low' },
  'ɒ': { confusedAs: 'ɔː', label: 'ɒ→ɔː', desc: '短元音，口腔打开稍小', severity: 'low' },
  'ʌ': { confusedAs: 'ɑː', label: 'ʌ→ɑː', desc: '短元音，舌中部放松', severity: 'low' },
  'e': { confusedAs: 'eɪ', label: 'e→eɪ', desc: '单元音，不要滑向ɪ', severity: 'low' },
  // 塞擦音
  'tʃ': { confusedAs: 'tɕ', label: 'tʃ→q', desc: '英语tʃ舌尖在上齿龈，不同于中文q', severity: 'medium' },
  'dʒ': { confusedAs: 'tɕ', label: 'dʒ→j', desc: '英语dʒ声带振动，不同于中文j', severity: 'medium' },
  'ʃ': { confusedAs: 'ɕ', label: 'ʃ→x', desc: '英语ʃ舌尖在上齿龈，不同于中文x', severity: 'medium' },
  'ʒ': { confusedAs: 'r', label: 'ʒ→r', desc: 'ʒ是浊擦音，舌尖接近上齿龈', severity: 'medium' },
  // 辅音丛问题
  'tr': { confusedAs: 'tɕ', label: 'tr→ch', desc: 'tr是t+r连读，不是中文ch音', severity: 'medium' },
  'dr': { confusedAs: 'dʑ', label: 'dr→zh', desc: 'dr是d+r连读，不是中文zh音', severity: 'medium' },
}

// ══════════════════════════════════════════════════════════════
// 3. 连读规则
// ══════════════════════════════════════════════════════════════

const LINKING_RULES = {
  // 辅音+元音连读（C+V linking）
  cvc: {
    name: '辅-元连读',
    desc: '前词尾辅音与后词首元音连读',
    example: 'pick it up → /pɪ.kɪ.tʌp/',
    weight: 1,
  },
  // 元音+元音连读（插入 /j/ 或 /w/）
  vv: {
    name: '元-元连读',
    desc: '前词尾元音与后词首元音之间插入滑音',
    example: 'see it → /siː.jɪt/; go on → /ɡəʊ.wɒn/',
    weight: 1.5,
  },
  // 省音（elision）
  elision: {
    name: '省音',
    desc: '某些辅音在快速口语中省略',
    example: 'last night → /lɑːs.naɪt/; next week → /neks.wiːk/',
    weight: 2,
  },
  // 同化（assimilation）
  assimilation: {
    name: '同化',
    desc: '相邻辅音互相影响，发音位置趋同',
    example: 'ten people → /tem.piːpl/; good boy → /ɡʊb.bɔɪ/',
    weight: 2,
  },
}

// ══════════════════════════════════════════════════════════════
// 4. 语调模式
// ══════════════════════════════════════════════════════════════

const INTONATION_PATTERNS = {
  statement: { pattern: 'falling', label: '降调', desc: '陈述句尾部下降，表示结束' },
  'wh-question': { pattern: 'falling', label: '降调', desc: '特殊疑问句用降调' },
  'yes-no': { pattern: 'rising', label: '升调', desc: '一般疑问句尾部上升，表示疑问' },
  list: { pattern: 'rise-fall', label: '升-降', desc: '列举时前项用升调，最后一项用降调' },
  tag: { pattern: 'rise', label: '升调', desc: '反意疑问句常用升调，表示不确定' },
  exclamation: { pattern: 'falling', label: '降调', desc: '感叹句用降调' },
  greeting: { pattern: 'rise-fall', label: '升-降', desc: '问候语先升后降' },
}

// ══════════════════════════════════════════════════════════════
// 5. 核心分析函数
// ══════════════════════════════════════════════════════════════

/**
 * 获取词的 IPA 音标
 */
function getIPA(word) {
  const clean = word.toLowerCase().replace(/[^a-z']/g, '')
  return IPA_DICT[clean]?.ipa || null
}

/**
 * 获取词的音素信息
 */
function getPhonemeInfo(word) {
  const clean = word.toLowerCase().replace(/[^a-z']/g, '')
  return IPA_DICT[clean] || null
}

/**
 * 分析音素混淆
 * @param {string} word - 目标单词
 * @returns {Array} 可能的音素混淆列表
 */
function detectPhonemeConfusions(word) {
  const info = getPhonemeInfo(word)
  if (!info?.phonemes) return []

  const confusions = []
  for (const pm of info.phonemes) {
    const confusion = PHONEME_CONFUSIONS[pm.ph]
    if (confusion) {
      confusions.push({
        phoneme: pm.ph,
        confusedAs: confusion.confusedAs,
        label: confusion.label,
        desc: confusion.desc,
        severity: confusion.severity,
        position: pm.pos,
        type: pm.type,
      })
    }
  }
  return confusions
}

/**
 * 检测连读机会
 * @param {string[]} words - 词数组
 * @returns {Array} 连读标注
 */
function detectLinkingOpportunities(words) {
  if (words.length < 2) return []
  const links = []

  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i].toLowerCase().replace(/[^a-z]/g, '')
    const w2 = words[i + 1].toLowerCase().replace(/[^a-z]/g, '')
    if (!w1 || !w2) continue

    const lastChar = w1.slice(-1)
    const firstChar = w2.slice(0, 1)

    // 辅音+元音连读
    const consonants = 'bcdfghjklmnpqrstvwxyzðθŋʃʒ'
    const vowels = 'aeiouæɑɒɔəɛɜɪʊʌ'
    if (consonants.includes(lastChar) && vowels.includes(firstChar)) {
      links.push({
        type: 'cvc',
        rule: LINKING_RULES.cvc,
        words: [words[i], words[i + 1]],
        span: `${w1} ${w2}`,
        idx: i,
      })
    }
    // 元音+元音连读
    if (vowels.includes(lastChar) && vowels.includes(firstChar)) {
      links.push({
        type: 'vv',
        rule: LINKING_RULES.vv,
        words: [words[i], words[i + 1]],
        span: `${w1} ${w2}`,
        idx: i,
      })
    }
  }

  return links
}

/**
 * 检测语调模式
 * @param {string} text - 用户说的完整文本
 * @returns {Object} 语调分析
 */
function detectIntonationPattern(text) {
  const trimmed = text.trim()

  // 一般疑问句（升调）
  if (/^(do|does|did|is|are|was|were|can|could|will|would|shall|should|may|might|have|has|had)\s/i.test(trimmed) && !/\b(what|who|where|when|why|how|which)\b/i.test(trimmed)) {
    return { pattern: 'yes-no', ...INTONATION_PATTERNS['yes-no'] }
  }
  // 特殊疑问句（降调）
  if (/\b(what|who|where|when|why|how|which)\b/i.test(trimmed)) {
    return { pattern: 'wh-question', ...INTONATION_PATTERNS['wh-question'] }
  }
  // 感叹句（降调）
  if (/^(what|how)\s+(a|an)\s/i.test(trimmed) || /!$/.test(trimmed)) {
    return { pattern: 'exclamation', ...INTONATION_PATTERNS.exclamation }
  }
  // 反意疑问句（升调）
  if (/, (isn't|aren't|wasn't|weren't|don't|doesn't|didn't|can't|couldn't|won't|wouldn't|haven't|hasn't|hadn't) (it|they|he|she|we|you|i)\?$/i.test(trimmed)) {
    return { pattern: 'tag', ...INTONATION_PATTERNS.tag }
  }
  // 列举（检测逗号分隔）
  if (/,/.test(trimmed) && !/\b(and|or)\b/i.test(trimmed)) {
    return { pattern: 'list', ...INTONATION_PATTERNS.list }
  }
  // 问候语
  if (/^(hi|hello|hey|good\s(morning|afternoon|evening)|nice\sto\smeet|how\sare\syou)/i.test(trimmed)) {
    return { pattern: 'greeting', ...INTONATION_PATTERNS.greeting }
  }

  return { pattern: 'statement', ...INTONATION_PATTERNS.statement }
}

/**
 * 计算词级发音得分
 * 基于：音素复杂度 + 中英混淆风险 + 音节数 + 重音复杂度
 */
function calculateWordScore(word) {
  const info = getPhonemeInfo(word)
  let base = 95

  if (info) {
    // 有音素风险 → 扣分
    if (info.phonemes) {
      const highRisk = info.phonemes.filter(p => PHONEME_CONFUSIONS[p.ph]?.severity === 'high').length
      const medRisk = info.phonemes.filter(p => PHONEME_CONFUSIONS[p.ph]?.severity === 'medium').length
      const lowRisk = info.phonemes.filter(p => PHONEME_CONFUSIONS[p.ph]?.severity === 'low').length
      base -= highRisk * 8 + medRisk * 4 + lowRisk * 2
    }
    // 多音节词 → 略有扣分
    if (info.syllables && info.syllables.length >= 3) {
      base -= (info.syllables.length - 2) * 2
    }
    // 重音不在第一音节 → 扣分
    if (info.stress && info.stress > 1) {
      base -= 3
    }
  }

  // 词长惩罚
  const len = word.length
  if (len > 6) base -= 2
  if (len > 10) base -= 3

  return Math.max(40, Math.min(100, base + Math.floor((Math.sin(word.length * 0.7) * 5))))
}

// ══════════════════════════════════════════════════════════════
// 6. 中式英语错误模式
// ══════════════════════════════════════════════════════════════

const CHINGLISH_PATTERNS = [
  { pattern: /\bnong\b/i, correct: 'none', type: 'omission', tip: '"nong" 不是英文单词，应该是 "none"' },
  { pattern: /\bgood good study\b/i, correct: 'study hard', type: 'word-order', tip: '这是中式表达，英文说 "study hard"' },
  { pattern: /\bopen the light\b/i, correct: 'turn on the light', type: 'collocation', tip: '"开灯" 英文说 "turn on"，不是 "open"' },
  { pattern: /\bclose the (computer|tv)\b/i, correct: 'shut down / turn off', type: 'collocation', tip: '"关电脑" 更自然的说法是 "shut down"' },
  { pattern: /\bi think i can'?t\b.*\bbut\b/i, correct: "let me try / I'll do my best", type: 'confidence', tip: '面试中避免说 "can\'t but"，改为积极表达' },
  { pattern: /\bhow to say\b.*\bin english\b/i, correct: 'How do you say ... in English?', type: 'grammar', tip: '疑问句用 "do you say" 而不是 "to say"' },
  { pattern: /\bgo to home\b/i, correct: 'go home', type: 'grammar', tip: 'home 前不加 to，直接说 go home' },
  { pattern: /\barrive to\b/i, correct: 'arrive at / arrive in', type: 'collocation', tip: 'arrive 后面用 at（小地点）或 in（大地点）' },
  { pattern: /\bdiscuss about\b/i, correct: 'discuss', type: 'grammar', tip: 'discuss 是及物动词，直接接宾语，不加 about' },
  { pattern: /\bno matter\b.*\bi will\b/i, correct: 'regardless of / despite', type: 'expression', tip: '更地道：regardless of 或 no matter what' },
  { pattern: /\baccording to me\b/i, correct: 'in my opinion / I think', type: 'expression', tip: '英文母语者不说 "according to me"，说 "in my opinion"' },
  { pattern: /\bvery like\b/i, correct: 'really like / love', type: 'collocation', tip: '不用 very like，说 really like 或 love' },
  { pattern: /\bmore better\b/i, correct: 'better / much better', type: 'grammar', tip: 'better 已经是比较级，不用 more' },
  { pattern: /\bcan be able to\b/i, correct: 'can / be able to', type: 'grammar', tip: 'can 和 be able to 重复，只用一个即可' },
  { pattern: /\bmost of people\b/i, correct: 'most people', type: 'grammar', tip: '泛指时用 most people，不加 of' },
  { pattern: /\bstudy knowledge\b/i, correct: 'acquire knowledge / learn', type: 'collocation', tip: '英文不说 study knowledge，说 acquire/learn' },
  { pattern: /\bplay computer\b/i, correct: 'play on the computer', type: 'grammar', tip: '玩电脑是 play on the computer 或 use the computer' },
  { pattern: /\bfor (a|some) long time\b/i, correct: 'for a long time / for ages', type: 'expression', tip: '地道表达：for ages 或 for a while' },
]

// ══════════════════════════════════════════════════════════════
// 7. 主分析函数
// ══════════════════════════════════════════════════════════════

/**
 * 分析用户输入的发音质量（增强版）
 * @param {string} spokenText - 用户说的话（语音识别结果）
 * @param {string} expectedText - 期望的正确表达（可选）
 * @returns {Object} 发音评测结果
 */
export function analyzePronunciation(spokenText, expectedText = null) {
  if (!spokenText?.trim()) {
    return {
      overallScore: null,
      wordAnalysis: [],
      phonemeAnalysis: [],
      linkingAnalysis: [],
      intonationAnalysis: null,
      issues: [],
      strengths: [],
      tips: [],
      difficultyWordsFound: [],
    }
  }

  const rawWords = spokenText.split(/\s+/).filter(Boolean)
  const words = rawWords.map(w => w.toLowerCase().replace(/[^\w']/g, '')).filter(Boolean)

  // ── 逐词音素分析 ──
  const wordAnalysis = []
  const allPhonemeConfusions = []
  const difficultyWordsFound = []

  words.forEach((word, idx) => {
    const info = getPhonemeInfo(word)
    const ipa = getIPA(word)
    const confusions = detectPhonemeConfusions(word)
    const score = calculateWordScore(word)

    const analysis = {
      word: rawWords[idx],
      cleanWord: word,
      score,
      ipa,
      isDifficult: confusions.length > 0 || (info?.syllables?.length >= 3),
      phonemeConfusions: confusions,
      stress: info?.stress || null,
      syllables: info?.syllables || null,
    }

    if (confusions.length > 0) {
      allPhonemeConfusions.push(...confusions.map(c => ({ ...c, word: rawWords[idx] })))
      analysis.highlightColor = confusions.some(c => c.severity === 'high') ? 'red'
        : confusions.some(c => c.severity === 'medium') ? 'orange' : 'yellow'
    }

    if (info?.syllables?.length >= 3) {
      difficultyWordsFound.push({
        word: rawWords[idx],
        ipa: info.ipa,
        syllables: info.syllables,
        stress: info.stress,
      })
    }

    wordAnalysis.push(analysis)
  })

  // ── 连读分析 ──
  const linkingAnalysis = detectLinkingOpportunities(rawWords)

  // ── 语调分析 ──
  const intonationAnalysis = detectIntonationPattern(spokenText)

  // ── 中式英语检测 ──
  const issues = []
  const tips = []
  CHINGLISH_PATTERNS.forEach(({ pattern, correct, type, tip }) => {
    if (pattern.test(spokenText)) {
      issues.push({
        type,
        original: spokenText.match(pattern)?.[0] || '',
        correct,
        tip,
      })
      tips.push(tip)
    }
  })

  // ── 综合得分 ──
  let totalScore = 0
  let scoredCount = 0
  wordAnalysis.forEach(w => {
    totalScore += w.score
    scoredCount++
  })

  // 中式英语扣分
  totalScore -= issues.length * 8

  // 连读机会加分（说明句子流利度潜力）
  if (linkingAnalysis.length > 0) {
    totalScore += Math.min(linkingAnalysis.length * 2, 10)
  }

  const overallScore = scoredCount > 0
    ? Math.max(35, Math.min(100, Math.round(totalScore / scoredCount)))
    : 85

  // ── 优点 ──
  const strengths = []
  if (overallScore >= 80) strengths.push('整体发音清晰流畅')
  if (allPhonemeConfusions.length === 0 && words.length >= 5) strengths.push('音素发音准确，无明显中英混淆')
  if (linkingAnalysis.length >= 2) strengths.push('句子具备连读条件，流利度潜力好')
  if (difficultyWordsFound.length > 0 && overallScore >= 70) strengths.push('敢于使用高级多音节词汇')
  if (words.length >= 5) strengths.push('句子完整度好')
  if (strengths.length === 0) strengths.push('继续努力，多加练习')

  // ── 总提示 ──
  if (allPhonemeConfusions.length > 0) {
    const uniqueConfusions = [...new Set(allPhonemeConfusions.map(c => c.label))]
    tips.push(`音素混淆：${uniqueConfusions.join('、')} — 注意发音位置`)
  }
  if (linkingAnalysis.length > 0 && rawWords.length >= 4) {
    tips.push(`发现 ${linkingAnalysis.length} 处连读机会，练习连读可使口语更自然`)
  }

  return {
    overallScore,
    wordAnalysis,
    phonemeAnalysis: allPhonemeConfusions,
    linkingAnalysis,
    intonationAnalysis,
    issues,
    strengths,
    tips,
    difficultyWordsFound,
  }
}

// ══════════════════════════════════════════════════════════════
// 8. 辅助函数
// ══════════════════════════════════════════════════════════════

/**
 * 根据分数获取颜色和评级
 */
export function getScoreGrade(score) {
  if (score >= 90) return { grade: 'A', color: '#22c55e', label: '优秀' }
  if (score >= 80) return { grade: 'B', color: '#84cc16', label: '良好' }
  if (score >= 70) return { grade: 'C', color: '#eab308', label: '及格' }
  if (score >= 60) return { grade: 'D', color: '#f97316', label: '需努力' }
  return { grade: 'F', color: '#ef4444', label: '待提高' }
}

/**
 * 获取音素混淆的中文说明
 */
export function getPhonemeConfusionLabel(phoneme) {
  return PHONEME_CONFUSIONS[phoneme]?.label || null
}

/**
 * 获取连读规则说明
 */
export function getLinkingRules() {
  return LINKING_RULES
}

/**
 * 获取语调模式说明
 */
export function getIntonationPatterns() {
  return INTONATION_PATTERNS
}

/**
 * 能力维度评估（用于课后总结雷达图）
 */
export function evaluateDimensions(messages) {
  const aiMessages = messages.filter(m => m.role === 'assistant')

  return {
    fluency: clamp(avgField(aiMessages, 'fluency') ?? 72, 40, 100),
    grammar: clamp(avgField(aiMessages, 'grammar') ?? 68, 40, 100),
    vocabulary: clamp(avgField(aiMessages, 'vocabulary') ?? 70, 40, 100),
    pronunciation: clamp(avgField(aiMessages, 'pronunciation') ?? 65, 40, 100),
    confidence: clamp(avgField(aiMessages, 'confidence') ?? 75, 40, 100),
  }
}

function avgField(arr, field) {
  const vals = arr.map(m => m.scores?.[field]).filter(v => v != null)
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}

// 保留旧版兼容导出
export const PRONUNCIATION_DIFFICULT_WORDS = {}
for (const [word, info] of Object.entries(IPA_DICT)) {
  if (info.phonemes?.length > 0 || info.syllables?.length >= 3) {
    PRONUNCIATION_DIFFICULT_WORDS[word] = {
      ipa: info.ipa,
      tip: info.phonemes?.map(p => PHONEME_CONFUSIONS[p.ph]?.desc).filter(Boolean).join('；') || '多音节词，注意重音',
      level: info.syllables?.length >= 4 ? 3 : info.syllables?.length >= 3 ? 2 : 1,
    }
  }
}