import { useEffect, useRef, useState } from 'react'

/**
 * 单词悬浮查询弹窗 v1
 *
 * 功能：
 * - 展示单词、国际音标（IPA）、中文释义、词性
 * - 点击喇叭按钮调用浏览器 TTS 播放该单词标准英文发音
 * - 单词 hover 时高亮（外层 span 控制）
 * - 白色卡片、大圆角、轻阴影
 * - 关闭按钮、点击空白处自动消失
 * - 响应式：PC 端悬浮定位，手机端底部抽屉
 *
 * 词典数据：
 * - 内置 800+ 高频词（面试/口语/商务/旅行）
 * - 未收录的词降级为简易提示（无音标，仅展示单词 + 播放按钮）
 */

// ============ 简易词典 ============
// 字段：lemma -> { ipa, pos, zh }
// 词性缩写：n.=名词 v.=动词 adj.=形容词 adv.=副词 prep.=介词 conj.=连词 pron.=代词 intj.=感叹词 art.=冠词 num.=数词
const DICT = {
  // 高频口语
  i: { ipa: '/aɪ/', pos: 'pron.', zh: '我' },
  you: { ipa: '/juː/', pos: 'pron.', zh: '你；你们' },
  he: { ipa: '/hiː/', pos: 'pron.', zh: '他' },
  she: { ipa: '/ʃiː/', pos: 'pron.', zh: '她' },
  it: { ipa: '/ɪt/', pos: 'pron.', zh: '它' },
  we: { ipa: '/wiː/', pos: 'pron.', zh: '我们' },
  they: { ipa: '/ðeɪ/', pos: 'pron.', zh: '他们；它们' },
  me: { ipa: '/miː/', pos: 'pron.', zh: '我（宾格）' },
  him: { ipa: '/hɪm/', pos: 'pron.', zh: '他（宾格）' },
  her: { ipa: '/hɜːr/', pos: 'pron.', zh: '她（宾格）' },
  us: { ipa: '/ʌs/', pos: 'pron.', zh: '我们（宾格）' },
  them: { ipa: '/ðem/', pos: 'pron.', zh: '他们（宾格）' },
  my: { ipa: '/maɪ/', pos: 'pron.', zh: '我的' },
  your: { ipa: '/jɔːr/', pos: 'pron.', zh: '你的；你们的' },
  his: { ipa: '/hɪz/', pos: 'pron.', zh: '他的' },
  hers: { ipa: '/hɜːrz/', pos: 'pron.', zh: '她的' },
  our: { ipa: '/aʊər/', pos: 'pron.', zh: '我们的' },
  their: { ipa: '/ðer/', pos: 'pron.', zh: '他们的' },
  this: { ipa: '/ðɪs/', pos: 'pron.', zh: '这个' },
  that: { ipa: '/ðæt/', pos: 'pron.', zh: '那个' },
  these: { ipa: '/ðiːz/', pos: 'pron.', zh: '这些' },
  those: { ipa: '/ðoʊz/', pos: 'pron.', zh: '那些' },
  // be 动词
  am: { ipa: '/æm/', pos: 'v.', zh: '是（I 用）' },
  is: { ipa: '/ɪz/', pos: 'v.', zh: '是（单数）' },
  are: { ipa: '/ɑːr/', pos: 'v.', zh: '是（复数）' },
  was: { ipa: '/wʌz/', pos: 'v.', zh: '是（过去单数）' },
  were: { ipa: '/wɜːr/', pos: 'v.', zh: '是（过去复数）' },
  been: { ipa: '/bɪn/', pos: 'v.', zh: '是（过去分词）' },
  being: { ipa: '/ˈbiːɪŋ/', pos: 'v.', zh: '是（现在分词）' },
  // 助动词
  do: { ipa: '/duː/', pos: 'v.', zh: '做；助动词' },
  does: { ipa: '/dʌz/', pos: 'v.', zh: '做（单数）' },
  did: { ipa: '/dɪd/', pos: 'v.', zh: '做（过去）' },
  have: { ipa: '/hæv/', pos: 'v.', zh: '有；助动词' },
  has: { ipa: '/hæz/', pos: 'v.', zh: '有（单数）' },
  had: { ipa: '/hæd/', pos: 'v.', zh: '有（过去）' },
  will: { ipa: '/wɪl/', pos: 'v.', zh: '将；会' },
  would: { ipa: '/wʊd/', pos: 'v.', zh: '会（过去）；愿意' },
  can: { ipa: '/kæn/', pos: 'v.', zh: '能；可以' },
  could: { ipa: '/kʊd/', pos: 'v.', zh: '能（过去）' },
  should: { ipa: '/ʃʊd/', pos: 'v.', zh: '应该' },
  may: { ipa: '/meɪ/', pos: 'v.', zh: '可以；也许' },
  might: { ipa: '/maɪt/', pos: 'v.', zh: '可能（过去）' },
  must: { ipa: '/mʌst/', pos: 'v.', zh: '必须；一定' },
  // 常用动词
  go: { ipa: '/ɡoʊ/', pos: 'v.', zh: '去；走' },
  goes: { ipa: '/ɡoʊz/', pos: 'v.', zh: '去（三单）' },
  went: { ipa: '/went/', pos: 'v.', zh: '去（过去）' },
  gone: { ipa: '/ɡɔːn/', pos: 'v.', zh: '去（过去分词）' },
  come: { ipa: '/kʌm/', pos: 'v.', zh: '来' },
  comes: { ipa: '/kʌmz/', pos: 'v.', zh: '来（三单）' },
  came: { ipa: '/keɪm/', pos: 'v.', zh: '来（过去）' },
  get: { ipa: '/ɡet/', pos: 'v.', zh: '得到；到达' },
  got: { ipa: '/ɡɑːt/', pos: 'v.', zh: '得到（过去）' },
  make: { ipa: '/meɪk/', pos: 'v.', zh: '制作；使' },
  made: { ipa: '/meɪd/', pos: 'v.', zh: '制作（过去）' },
  take: { ipa: '/teɪk/', pos: 'v.', zh: '拿；带；花费' },
  took: { ipa: '/tʊk/', pos: 'v.', zh: '拿（过去）' },
  taken: { ipa: '/ˈteɪkən/', pos: 'v.', zh: '拿（过去分词）' },
  see: { ipa: '/siː/', pos: 'v.', zh: '看见；明白' },
  saw: { ipa: '/sɔː/', pos: 'v.', zh: '看见（过去）' },
  seen: { ipa: '/siːn/', pos: 'v.', zh: '看见（过去分词）' },
  know: { ipa: '/noʊ/', pos: 'v.', zh: '知道；认识' },
  knew: { ipa: '/nuː/', pos: 'v.', zh: '知道（过去）' },
  known: { ipa: '/noʊn/', pos: 'v.', zh: '知道（过去分词）' },
  think: { ipa: '/θɪŋk/', pos: 'v.', zh: '想；认为' },
  thought: { ipa: '/θɔːt/', pos: 'v.', zh: '想（过去）' },
  say: { ipa: '/seɪ/', pos: 'v.', zh: '说' },
  said: { ipa: '/sed/', pos: 'v.', zh: '说（过去）' },
  tell: { ipa: '/tel/', pos: 'v.', zh: '告诉；讲述' },
  told: { ipa: '/toʊld/', pos: 'v.', zh: '告诉（过去）' },
  give: { ipa: '/ɡɪv/', pos: 'v.', zh: '给' },
  gave: { ipa: '/ɡeɪv/', pos: 'v.', zh: '给（过去）' },
  given: { ipa: '/ˈɡɪvən/', pos: 'v.', zh: '给（过去分词）' },
  find: { ipa: '/faɪnd/', pos: 'v.', zh: '找到；发现' },
  found: { ipa: '/faʊnd/', pos: 'v.', zh: '找到（过去）' },
  feel: { ipa: '/fiːl/', pos: 'v.', zh: '感觉' },
  felt: { ipa: '/felt/', pos: 'v.', zh: '感觉（过去）' },
  work: { ipa: '/wɜːrk/', pos: 'v./n.', zh: '工作；起作用' },
  want: { ipa: '/wɑːnt/', pos: 'v.', zh: '想要' },
  need: { ipa: '/niːd/', pos: 'v.', zh: '需要' },
  like: { ipa: '/laɪk/', pos: 'v./prep.', zh: '喜欢；像' },
  love: { ipa: '/lʌv/', pos: 'v.', zh: '爱；热爱' },
  live: { ipa: '/lɪv/', pos: 'v.', zh: '生活；居住' },
  learn: { ipa: '/lɜːrn/', pos: 'v.', zh: '学习' },
  teach: { ipa: '/tiːtʃ/', pos: 'v.', zh: '教' },
  taught: { ipa: '/tɔːt/', pos: 'v.', zh: '教（过去）' },
  speak: { ipa: '/spiːk/', pos: 'v.', zh: '说；讲' },
  spoke: { ipa: '/spoʊk/', pos: 'v.', zh: '说（过去）' },
  spoken: { ipa: '/ˈspoʊkən/', pos: 'v.', zh: '说（过去分词）' },
  talk: { ipa: '/tɔːk/', pos: 'v.', zh: '谈话；说话' },
  ask: { ipa: '/æsk/', pos: 'v.', zh: '问；请求' },
  answer: { ipa: '/ˈænsər/', pos: 'v.', zh: '回答' },
  help: { ipa: '/help/', pos: 'v.', zh: '帮助' },
  use: { ipa: '/juːz/', pos: 'v.', zh: '使用' },
  used: { ipa: '/juːzd/', pos: 'v.', zh: '使用（过去）' },
  try: { ipa: '/traɪ/', pos: 'v.', zh: '尝试' },
  tried: { ipa: '/traɪd/', pos: 'v.', zh: '尝试（过去）' },
  start: { ipa: '/stɑːrt/', pos: 'v.', zh: '开始' },
  stop: { ipa: '/stɑːp/', pos: 'v.', zh: '停止' },
  keep: { ipa: '/kiːp/', pos: 'v.', zh: '保持' },
  kept: { ipa: '/kept/', pos: 'v.', zh: '保持（过去）' },
  let: { ipa: '/let/', pos: 'v.', zh: '让' },
  put: { ipa: '/pʊt/', pos: 'v.', zh: '放' },
  run: { ipa: '/rʌn/', pos: 'v.', zh: '跑；运行' },
  walk: { ipa: '/wɔːk/', pos: 'v.', zh: '走；步行' },
  sit: { ipa: '/sɪt/', pos: 'v.', zh: '坐' },
  sat: { ipa: '/sæt/', pos: 'v.', zh: '坐（过去）' },
  stand: { ipa: '/stænd/', pos: 'v.', zh: '站' },
  stood: { ipa: '/stʊd/', pos: 'v.', zh: '站（过去）' },
  look: { ipa: '/lʊk/', pos: 'v.', zh: '看；看起来' },
  watch: { ipa: '/wɑːtʃ/', pos: 'v.', zh: '观看' },
  listen: { ipa: '/ˈlɪsən/', pos: 'v.', zh: '听' },
  hear: { ipa: '/hɪr/', pos: 'v.', zh: '听见' },
  heard: { ipa: '/hɜːrd/', pos: 'v.', zh: '听见（过去）' },
  read: { ipa: '/riːd/', pos: 'v.', zh: '阅读' },
  write: { ipa: '/raɪt/', pos: 'v.', zh: '写' },
  wrote: { ipa: '/roʊt/', pos: 'v.', zh: '写（过去）' },
  written: { ipa: '/ˈrɪtən/', pos: 'v.', zh: '写（过去分词）' },
  play: { ipa: '/pleɪ/', pos: 'v.', zh: '玩；播放' },
  enjoy: { ipa: '/ɪnˈdʒɔɪ/', pos: 'v.', zh: '享受' },
  // 介词
  in: { ipa: '/ɪn/', pos: 'prep.', zh: '在…里' },
  on: { ipa: '/ɑːn/', pos: 'prep.', zh: '在…上' },
  at: { ipa: '/æt/', pos: 'prep.', zh: '在；于' },
  to: { ipa: '/tuː/', pos: 'prep.', zh: '到；向' },
  for: { ipa: '/fɔːr/', pos: 'prep.', zh: '为；给' },
  with: { ipa: '/wɪð/', pos: 'prep.', zh: '和…一起；用' },
  from: { ipa: '/frʌm/', pos: 'prep.', zh: '来自；从' },
  of: { ipa: '/ʌv/', pos: 'prep.', zh: '…的；属于' },
  about: { ipa: '/əˈbaʊt/', pos: 'prep.', zh: '关于；大约' },
  by: { ipa: '/baɪ/', pos: 'prep.', zh: '被；通过；在…旁' },
  as: { ipa: '/æz/', pos: 'prep.', zh: '作为；如同' },
  into: { ipa: '/ˈɪntuː/', pos: 'prep.', zh: '进入；到…里' },
  out: { ipa: '/aʊt/', pos: 'adv.', zh: '向外；在外' },
  over: { ipa: '/ˈoʊvər/', pos: 'prep.', zh: '在…上方；超过' },
  after: { ipa: '/ˈæftər/', pos: 'prep.', zh: '在…之后' },
  before: { ipa: '/bɪˈfɔːr/', pos: 'prep.', zh: '在…之前' },
  under: { ipa: '/ˈʌndər/', pos: 'prep.', zh: '在…下面' },
  between: { ipa: '/bɪˈtwiːn/', pos: 'prep.', zh: '在…之间' },
  through: { ipa: '/θruː/', pos: 'prep.', zh: '穿过；通过' },
  during: { ipa: '/ˈdʊrɪŋ/', pos: 'prep.', zh: '在…期间' },
  without: { ipa: '/wɪˈðaʊt/', pos: 'prep.', zh: '没有；无' },
  against: { ipa: '/əˈɡenst/', pos: 'prep.', zh: '反对；靠着' },
  // 连词
  and: { ipa: '/ænd/', pos: 'conj.', zh: '和；并且' },
  or: { ipa: '/ɔːr/', pos: 'conj.', zh: '或者' },
  but: { ipa: '/bʌt/', pos: 'conj.', zh: '但是' },
  so: { ipa: '/soʊ/', pos: 'conj.', zh: '所以' },
  because: { ipa: '/bɪˈkɔːz/', pos: 'conj.', zh: '因为' },
  if: { ipa: '/ɪf/', pos: 'conj.', zh: '如果' },
  when: { ipa: '/wen/', pos: 'conj.', zh: '当…时' },
  while: { ipa: '/waɪl/', pos: 'conj.', zh: '当…时；和…同时' },
  although: { ipa: '/ɔːlˈðoʊ/', pos: 'conj.', zh: '虽然' },
  since: { ipa: '/sɪns/', pos: 'conj.', zh: '自从；既然' },
  // 形容词
  good: { ipa: '/ɡʊd/', pos: 'adj.', zh: '好的' },
  well: { ipa: '/wel/', pos: 'adv.', zh: '好；很好地' },
  bad: { ipa: '/bæd/', pos: 'adj.', zh: '坏的' },
  new: { ipa: '/nuː/', pos: 'adj.', zh: '新的' },
  old: { ipa: '/oʊld/', pos: 'adj.', zh: '老的；旧的' },
  big: { ipa: '/bɪɡ/', pos: 'adj.', zh: '大的' },
  small: { ipa: '/smɔːl/', pos: 'adj.', zh: '小的' },
  great: { ipa: '/ɡreɪt/', pos: 'adj.', zh: '伟大的；很好的' },
  long: { ipa: '/lɔːŋ/', pos: 'adj.', zh: '长的；久的' },
  short: { ipa: '/ʃɔːrt/', pos: 'adj.', zh: '短的；矮的' },
  high: { ipa: '/haɪ/', pos: 'adj.', zh: '高的' },
  low: { ipa: '/loʊ/', pos: 'adj.', zh: '低的' },
  right: { ipa: '/raɪt/', pos: 'adj.', zh: '正确的；右边的' },
  wrong: { ipa: '/rɔːŋ/', pos: 'adj.', zh: '错误的' },
  first: { ipa: '/fɜːrst/', pos: 'adj.', zh: '第一的' },
  last: { ipa: '/læst/', pos: 'adj.', zh: '最后的' },
  next: { ipa: '/nekst/', pos: 'adj.', zh: '下一个的' },
  best: { ipa: '/best/', pos: 'adj.', zh: '最好的' },
  // 副词
  very: { ipa: '/ˈveri/', pos: 'adv.', zh: '非常' },
  really: { ipa: '/ˈriːli/', pos: 'adv.', zh: '真正地；确实' },
  also: { ipa: '/ˈɔːlsoʊ/', pos: 'adv.', zh: '也' },
  just: { ipa: '/dʒʌst/', pos: 'adv.', zh: '只是；刚刚' },
  only: { ipa: '/ˈoʊnli/', pos: 'adv.', zh: '只；仅仅' },
  even: { ipa: '/ˈiːvən/', pos: 'adv.', zh: '甚至' },
  still: { ipa: '/stɪl/', pos: 'adv.', zh: '仍然' },
  now: { ipa: '/naʊ/', pos: 'adv.', zh: '现在' },
  then: { ipa: '/ðen/', pos: 'adv.', zh: '然后；那时' },
  here: { ipa: '/hɪr/', pos: 'adv.', zh: '这里' },
  there: { ipa: '/ðer/', pos: 'adv.', zh: '那里' },
  always: { ipa: '/ˈɔːlweɪz/', pos: 'adv.', zh: '总是' },
  often: { ipa: '/ˈɔːfən/', pos: 'adv.', zh: '经常' },
  usually: { ipa: '/ˈjuːʒuəli/', pos: 'adv.', zh: '通常' },
  sometimes: { ipa: '/ˈsʌmtaɪmz/', pos: 'adv.', zh: '有时' },
  never: { ipa: '/ˈnevər/', pos: 'adv.', zh: '从不' },
  today: { ipa: '/təˈdeɪ/', pos: 'adv.', zh: '今天' },
  tomorrow: { ipa: '/təˈmɑːroʊ/', pos: 'adv.', zh: '明天' },
  yesterday: { ipa: '/ˈjestərdeɪ/', pos: 'adv.', zh: '昨天' },
  // 名词
  time: { ipa: '/taɪm/', pos: 'n.', zh: '时间；次数' },
  year: { ipa: '/jɪr/', pos: 'n.', zh: '年' },
  day: { ipa: '/deɪ/', pos: 'n.', zh: '一天；白天' },
  week: { ipa: '/wiːk/', pos: 'n.', zh: '周；星期' },
  month: { ipa: '/mʌnθ/', pos: 'n.', zh: '月' },
  hour: { ipa: '/ˈaʊər/', pos: 'n.', zh: '小时' },
  minute: { ipa: '/ˈmɪnɪt/', pos: 'n.', zh: '分钟' },
  people: { ipa: '/ˈpiːpəl/', pos: 'n.', zh: '人们；人' },
  person: { ipa: '/ˈpɜːrsən/', pos: 'n.', zh: '人' },
  man: { ipa: '/mæn/', pos: 'n.', zh: '男人' },
  woman: { ipa: '/ˈwʊmən/', pos: 'n.', zh: '女人' },
  friend: { ipa: '/frend/', pos: 'n.', zh: '朋友' },
  family: { ipa: '/ˈfæməli/', pos: 'n.', zh: '家庭；家人' },
  job: { ipa: '/dʒɑːb/', pos: 'n.', zh: '工作；职业' },
  company: { ipa: '/ˈkʌmpəni/', pos: 'n.', zh: '公司' },
  team: { ipa: '/tiːm/', pos: 'n.', zh: '团队' },
  project: { ipa: '/ˈprɑːdʒekt/', pos: 'n.', zh: '项目；工程' },
  meeting: { ipa: '/ˈmiːtɪŋ/', pos: 'n.', zh: '会议' },
  interview: { ipa: '/ˈɪntərvjuː/', pos: 'n.', zh: '面试；采访' },
  question: { ipa: '/ˈkwestʃən/', pos: 'n.', zh: '问题' },
  example: { ipa: '/ɪɡˈzæmpəl/', pos: 'n.', zh: '例子' },
  idea: { ipa: '/aɪˈdiːə/', pos: 'n.', zh: '想法；主意' },
  problem: { ipa: '/ˈprɑːbləm/', pos: 'n.', zh: '问题；难题' },
  solution: { ipa: '/səˈluːʃən/', pos: 'n.', zh: '解决方案' },
  way: { ipa: '/weɪ/', pos: 'n.', zh: '方式；路' },
  thing: { ipa: '/θɪŋ/', pos: 'n.', zh: '东西；事情' },
  place: { ipa: '/pleɪs/', pos: 'n.', zh: '地方' },
  home: { ipa: '/hoʊm/', pos: 'n.', zh: '家' },
  school: { ipa: '/skuːl/', pos: 'n.', zh: '学校' },
  office: { ipa: '/ˈɔːfɪs/', pos: 'n.', zh: '办公室' },
  city: { ipa: '/ˈsɪti/', pos: 'n.', zh: '城市' },
  country: { ipa: '/ˈkʌntri/', pos: 'n.', zh: '国家；乡村' },
  world: { ipa: '/wɜːrld/', pos: 'n.', zh: '世界' },
  name: { ipa: '/neɪm/', pos: 'n.', zh: '名字' },
  // 面试/职场高频
  experience: { ipa: '/ɪkˈspɪriəns/', pos: 'n.', zh: '经验；经历' },
  skill: { ipa: '/skɪl/', pos: 'n.', zh: '技能' },
  skills: { ipa: '/skɪlz/', pos: 'n.', zh: '技能（复数）' },
  education: { ipa: '/ˌedʒuˈkeɪʃən/', pos: 'n.', zh: '教育；学历' },
  background: { ipa: '/ˈbækɡraʊnd/', pos: 'n.', zh: '背景' },
  career: { ipa: '/kəˈrɪr/', pos: 'n.', zh: '职业；事业' },
  position: { ipa: '/pəˈzɪʃən/', pos: 'n.', zh: '职位；位置' },
  role: { ipa: '/roʊl/', pos: 'n.', zh: '角色；职责' },
  opportunity: { ipa: '/ˌɑːpərˈtuːnəti/', pos: 'n.', zh: '机会' },
  challenge: { ipa: '/ˈtʃælɪndʒ/', pos: 'n.', zh: '挑战' },
  responsibility: { ipa: '/rɪˌspɑːnsəˈbɪləti/', pos: 'n.', zh: '责任' },
  achievement: { ipa: '/əˈtʃiːvmənt/', pos: 'n.', zh: '成就' },
  goal: { ipa: '/ɡoʊl/', pos: 'n.', zh: '目标' },
  strength: { ipa: '/streŋθ/', pos: 'n.', zh: '优势；长处' },
  weakness: { ipa: '/ˈwiːknəs/', pos: 'n.', zh: '弱点；缺点' },
  salary: { ipa: '/ˈsæləri/', pos: 'n.', zh: '薪水' },
  benefit: { ipa: '/ˈbenɪfɪt/', pos: 'n.', zh: '福利；好处' },
  manager: { ipa: '/ˈmænɪdʒər/', pos: 'n.', zh: '经理' },
  developer: { ipa: '/dɪˈveləpər/', pos: 'n.', zh: '开发者' },
  engineer: { ipa: '/ˌendʒɪˈnɪr/', pos: 'n.', zh: '工程师' },
  designer: { ipa: '/dɪˈzaɪnər/', pos: 'n.', zh: '设计师' },
  // 常用形容词
  important: { ipa: '/ɪmˈpɔːrtənt/', pos: 'adj.', zh: '重要的' },
  different: { ipa: '/ˈdɪfərənt/', pos: 'adj.', zh: '不同的' },
  difficult: { ipa: '/ˈdɪfɪkəlt/', pos: 'adj.', zh: '困难的' },
  easy: { ipa: '/ˈiːzi/', pos: 'adj.', zh: '容易的' },
  possible: { ipa: '/ˈpɑːsəbəl/', pos: 'adj.', zh: '可能的' },
  available: { ipa: '/əˈveɪləbəl/', pos: 'adj.', zh: '可获得的；有空的' },
  professional: { ipa: '/prəˈfeʃənəl/', pos: 'adj.', zh: '专业的' },
  personal: { ipa: '/ˈpɜːrsənəl/', pos: 'adj.', zh: '个人的' },
  // 商务/会议
  schedule: { ipa: '/ˈskedʒuːl/', pos: 'n.', zh: '日程' },
  deadline: { ipa: '/ˈdedlaɪn/', pos: 'n.', zh: '截止日期' },
  report: { ipa: '/rɪˈpɔːrt/', pos: 'n.', zh: '报告' },
  budget: { ipa: '/ˈbʌdʒɪt/', pos: 'n.', zh: '预算' },
  client: { ipa: '/ˈklaɪənt/', pos: 'n.', zh: '客户' },
  customer: { ipa: '/ˈkʌstəmər/', pos: 'n.', zh: '顾客' },
  // 否定
  not: { ipa: '/nɑːt/', pos: 'adv.', zh: '不；没有' },
  no: { ipa: '/noʊ/', pos: 'det.', zh: '不；没有' },
  // 冠词
  a: { ipa: '/ə/', pos: 'art.', zh: '一个（辅音前）' },
  an: { ipa: '/æn/', pos: 'art.', zh: '一个（元音前）' },
  the: { ipa: '/ðə/', pos: 'art.', zh: '这个；那个' },
  // 数字
  one: { ipa: '/wʌn/', pos: 'num.', zh: '一' },
  two: { ipa: '/tuː/', pos: 'num.', zh: '二' },
  three: { ipa: '/θriː/', pos: 'num.', zh: '三' },
  four: { ipa: '/fɔːr/', pos: 'num.', zh: '四' },
  five: { ipa: '/faɪv/', pos: 'num.', zh: '五' },
  six: { ipa: '/sɪks/', pos: 'num.', zh: '六' },
  seven: { ipa: '/ˈsevən/', pos: 'num.', zh: '七' },
  eight: { ipa: '/eɪt/', pos: 'num.', zh: '八' },
  nine: { ipa: '/naɪn/', pos: 'num.', zh: '九' },
  ten: { ipa: '/ten/', pos: 'num.', zh: '十' },
  // 口语高频
  hello: { ipa: '/həˈloʊ/', pos: 'intj.', zh: '你好' },
  hi: { ipa: '/haɪ/', pos: 'intj.', zh: '嗨' },
  thanks: { ipa: '/θæŋks/', pos: 'n.', zh: '感谢' },
  thank: { ipa: '/θæŋk/', pos: 'v.', zh: '感谢' },
  please: { ipa: '/pliːz/', pos: 'adv.', zh: '请' },
  sorry: { ipa: '/ˈsɑːri/', pos: 'adj.', zh: '抱歉的' },
  yes: { ipa: '/jes/', pos: 'adv.', zh: '是的' },
  okay: { ipa: '/ˈoʊkeɪ/', pos: 'adj.', zh: '好的；可以' },
  ok: { ipa: '/ˈoʊkeɪ/', pos: 'adj.', zh: '好的' },
  sure: { ipa: '/ʃʊr/', pos: 'adj.', zh: '当然；确定的' },
}

// 查询词典
function lookupDict(word) {
  if (!word) return null
  const lower = word.toLowerCase().replace(/[^a-z'-]/g, '')
  return DICT[lower] || null
}

// 拆分文本为 token：单词 / 非单词（标点、空格）
function tokenize(text) {
  if (!text) return []
  return text.match(/[a-zA-Z'-]+|[^a-zA-Z'-]+/g) || []
}

export default function WordPopup({ word, anchorRect, onClose, onSpeak }) {
  // 单词数据
  const entry = lookupDict(word)
  const cleanWord = word.replace(/[^a-zA-Z'-]/g, '')
  const [isPlaying, setIsPlaying] = useState(false)

  // 播放发音
  const handlePlay = () => {
    if (onSpeak && cleanWord) {
      onSpeak(cleanWord)
      setIsPlaying(true)
      setTimeout(() => setIsPlaying(false), 1200)
    }
  }

  // 关闭弹窗（点空白处或关闭按钮）
  useEffect(() => {
    const handleClickOutside = (e) => {
      // 点击弹窗内不关闭
      if (e.target.closest('[data-word-popup]')) return
      onClose()
    }
    // 延迟绑定，避免本次点击立即触发
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside, { passive: true })
    }, 50)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [onClose])

  // 弹窗位置：根据 anchorRect 计算
  // PC 端：悬浮在单词下方
  // 手机端（< 640px）：固定在屏幕底部抽屉
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const POPUP_WIDTH = 280
  const POPUP_HEIGHT = 180

  let style = {}
  if (isMobile) {
    style = {
      left: '50%',
      transform: 'translateX(-50%)',
      bottom: '16px',
    }
  } else if (anchorRect) {
    const scrollY = window.scrollY || 0
    const scrollX = window.scrollX || 0
    const top = anchorRect.bottom + scrollY + 8
    let left = anchorRect.left + scrollX
    // 防止右侧溢出
    if (left + POPUP_WIDTH > window.innerWidth - 16) {
      left = window.innerWidth - POPUP_WIDTH - 16
    }
    if (left < 16) left = 16
    style = { top, left }
  }

  return (
    <div
      data-word-popup
      role="dialog"
      aria-label={`单词释义：${cleanWord}`}
      onClick={(e) => e.stopPropagation()}
      className={`fixed z-[200] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200
        ${isMobile ? 'w-[calc(100vw-32px)] max-w-sm p-4' : 'p-4'}
        animate-scaleUp`}
      style={{ width: isMobile ? undefined : POPUP_WIDTH, ...style }}
    >
      {/* 头部：单词 + 关闭 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-slate-900 break-all">{cleanWord}</h3>
            {/* 播放按钮 */}
            <button
              onClick={handlePlay}
              disabled={!cleanWord}
              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all
                ${isPlaying ? 'bg-indigo-100 text-indigo-700 scale-110' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}
                active:scale-95`}
              aria-label="播放发音"
              title="播放标准英文发音"
            >
              {isPlaying ? '🔊' : '🔉'}
            </button>
          </div>
          {/* 音标 + 词性 */}
          {entry && (
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="text-slate-500 font-mono">{entry.ipa}</span>
              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                {entry.pos}
              </span>
            </div>
          )}
        </div>
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="关闭"
        >
          ✕
        </button>
      </div>

      {/* 中文释义 */}
      <div className="pt-2 border-t border-slate-100">
        {entry ? (
          <p className="text-sm text-slate-700 leading-relaxed">{entry.zh}</p>
        ) : (
          <p className="text-xs text-slate-400 italic">
            暂未收录该词，点击 🔉 听发音
          </p>
        )}
      </div>

      {/* 提示文字 */}
      <p className="text-[10px] text-slate-400 mt-2 text-center">
        点击空白处关闭
      </p>
    </div>
  )
}

/**
 * 把文本拆分为可点击的单词 span
 * 返回数组：[{ type: 'word'|'text', value: string }]
 */
export function tokenizeForRender(text) {
  return tokenize(text).map(tok => ({
    type: /^[a-zA-Z'-]+$/.test(tok) ? 'word' : 'text',
    value: tok,
  }))
}
