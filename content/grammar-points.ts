// 24 grammar points in four phases (accuracy first). Rule cards are short:
// a 60-second rule, two examples and one "Vietnamese trap" contrast.

export type PointSeed = {
  slug: string;
  phase: 1 | 2 | 3 | 4;
  sort: number;
  title: string;
  title_vi: string;
  error_codes: string[];
  rule_en: string;
  rule_vi: string;
  examples: { en: string; vi: string }[];
  trap: { wrong: string; right: string; note_vi: string };
};

export const GRAMMAR_POINTS: PointSeed[] = [
  // ---------------- Phase 1: Accuracy core ----------------
  {
    slug: "present-simple-continuous", phase: 1, sort: 1,
    title: "Present simple vs present continuous", title_vi: "Hiện tại đơn và hiện tại tiếp diễn",
    error_codes: ["TNS"],
    rule_en: "Use the present simple for facts, habits and general truths (Students study online). Use the present continuous for actions happening now or temporary trends (More students are studying online these days). State verbs (know, believe, own) are rarely continuous.",
    rule_vi: "Hiện tại đơn dùng cho sự thật, thói quen. Hiện tại tiếp diễn dùng cho việc đang xảy ra hoặc xu hướng tạm thời. Động từ chỉ trạng thái (know, believe) thường không dùng dạng -ing.",
    examples: [
      { en: "Most children start school at the age of six.", vi: "Hầu hết trẻ em bắt đầu đi học lúc sáu tuổi." },
      { en: "More adults are taking online courses this year.", vi: "Năm nay ngày càng nhiều người lớn học khóa học trực tuyến." },
    ],
    trap: { wrong: "I am knowing the answer.", right: "I know the answer.", note_vi: "Tiếng Việt có 'đang' cho mọi động từ, nhưng tiếng Anh không dùng -ing với động từ trạng thái." },
  },
  {
    slug: "past-simple", phase: 1, sort: 2,
    title: "Past simple (regular and irregular)", title_vi: "Quá khứ đơn (có quy tắc và bất quy tắc)",
    error_codes: ["TNS"],
    rule_en: "Use the past simple for finished actions at a finished time (yesterday, in 2010, last year). Regular verbs add -ed; irregular verbs change form (go → went, teach → taught). Negatives and questions use did + base verb.",
    rule_vi: "Quá khứ đơn dùng cho hành động đã kết thúc tại thời điểm đã qua. Động từ có quy tắc thêm -ed; bất quy tắc phải học thuộc. Câu phủ định/câu hỏi dùng did + động từ nguyên mẫu.",
    examples: [
      { en: "The school opened a new library in 2019.", vi: "Trường đã mở thư viện mới năm 2019." },
      { en: "She didn't go to university after high school.", vi: "Cô ấy đã không học đại học sau cấp ba." },
    ],
    trap: { wrong: "I go to school yesterday.", right: "I went to school yesterday.", note_vi: "Tiếng Việt chỉ cần 'hôm qua' để chỉ quá khứ; tiếng Anh phải đổi cả động từ." },
  },
  {
    slug: "present-perfect-past-simple", phase: 1, sort: 3,
    title: "Present perfect vs past simple", title_vi: "Hiện tại hoàn thành và quá khứ đơn",
    error_codes: ["TNS"],
    rule_en: "Use the present perfect (have/has + past participle) for a period that continues to now: since + a point in time, for + a length of time, and trends up to now (has increased). Use the past simple when the time is finished (in 2015, last year).",
    rule_vi: "Hiện tại hoàn thành dùng cho khoảng thời gian kéo dài đến hiện tại (since + mốc, for + khoảng) và xu hướng đến nay. Nếu thời gian đã kết thúc (in 2015, last year) thì dùng quá khứ đơn.",
    examples: [
      { en: "The number of international students has doubled since 2015.", vi: "Số sinh viên quốc tế đã tăng gấp đôi kể từ 2015." },
      { en: "Tuition fees rose sharply in 2020.", vi: "Học phí tăng mạnh vào năm 2020." },
    ],
    trap: { wrong: "I live here from 2020.", right: "I have lived here since 2020.", note_vi: "'Từ năm 2020' dịch thẳng thành 'from 2020' là sai; với khoảng thời gian đến nay phải dùng 'since' và thì hiện tại hoàn thành." },
  },
  {
    slug: "future-forms", phase: 1, sort: 4,
    title: "Future forms", title_vi: "Các cách diễn đạt tương lai",
    error_codes: ["TNS"],
    rule_en: "Use will for predictions and decisions made now; be going to for plans and predictions from evidence; the present continuous for fixed arrangements. After when, if, before and after, use the present simple for the future (when I finish school, not when I will finish).",
    rule_vi: "Will: dự đoán, quyết định tức thời. Be going to: kế hoạch, dự đoán có căn cứ. Hiện tại tiếp diễn: lịch hẹn cố định. Sau when/if/before/after dùng hiện tại đơn để nói về tương lai.",
    examples: [
      { en: "Online learning will probably become more common.", vi: "Học trực tuyến có lẽ sẽ phổ biến hơn." },
      { en: "When I finish high school, I am going to study abroad.", vi: "Khi học xong cấp ba, tôi sẽ đi du học." },
    ],
    trap: { wrong: "When I will graduate, I will look for a job.", right: "When I graduate, I will look for a job.", note_vi: "Tiếng Việt dùng 'sẽ' ở cả hai vế, nhưng sau 'when' tiếng Anh dùng hiện tại đơn." },
  },
  {
    slug: "sva-long-subjects", phase: 1, sort: 5,
    title: "Subject–verb agreement with long subjects", title_vi: "Hòa hợp chủ ngữ – động từ với chủ ngữ dài",
    error_codes: ["SVA"],
    rule_en: "The verb agrees with the head noun of the subject, not the nearest noun. The number of students IS rising; The cost of textbooks HAS increased. Third person singular present verbs need -s: He studies, The school offers.",
    rule_vi: "Động từ hòa hợp với danh từ chính của chủ ngữ, không phải danh từ gần nhất. Ngôi thứ ba số ít ở hiện tại phải thêm -s.",
    examples: [
      { en: "The quality of schools in rural areas is improving.", vi: "Chất lượng trường học ở nông thôn đang được cải thiện." },
      { en: "Every student in these classes has a laptop.", vi: "Mỗi học sinh trong các lớp này đều có máy tính xách tay." },
    ],
    trap: { wrong: "Joe buy food on the weekend.", right: "Joe buys food on the weekend.", note_vi: "Động từ tiếng Việt không đổi theo chủ ngữ, nên người Việt hay quên thêm -s." },
  },
  {
    slug: "countable-plurals", phase: 1, sort: 6,
    title: "Countable vs uncountable nouns and plurals", title_vi: "Danh từ đếm được, không đếm được và số nhiều",
    error_codes: ["PLU"],
    rule_en: "Countable nouns need a plural -s after numbers and words like many, several, a few (two dictionaries, many students). Uncountable nouns have no plural and use much, little, a piece of (information, advice, knowledge, equipment, homework).",
    rule_vi: "Danh từ đếm được cần -s sau số đếm và many/several/a few. Danh từ không đếm được (information, advice, knowledge, equipment) không có số nhiều, dùng much/little/a piece of.",
    examples: [
      { en: "Students need several skills to succeed.", vi: "Học sinh cần nhiều kỹ năng để thành công." },
      { en: "Teachers give useful advice about careers.", vi: "Giáo viên đưa ra lời khuyên hữu ích về nghề nghiệp." },
    ],
    trap: { wrong: "two dictionary, many informations", right: "two dictionaries, a lot of information", note_vi: "Tiếng Việt chỉ thể hiện số nhiều bằng số đếm ('hai cuốn từ điển'), nên dễ quên -s; 'thông tin' trong tiếng Anh lại không đếm được." },
  },
  {
    slug: "articles", phase: 1, sort: 7,
    title: "Articles: a/an/the/zero", title_vi: "Mạo từ a/an/the/không mạo từ",
    error_codes: ["ART"],
    rule_en: "Use a/an with a singular countable noun mentioned for the first time or as one of many. Use the when the reader knows which one (the government, the education system of Vietnam). Use no article for general plural or uncountable nouns (Education is important).",
    rule_vi: "A/an: danh từ đếm được số ít, nhắc lần đầu. The: khi người đọc biết rõ là cái nào. Không dùng mạo từ khi nói chung chung với danh từ số nhiều hoặc không đếm được.",
    examples: [
      { en: "The government should invest in the education system.", vi: "Chính phủ nên đầu tư vào hệ thống giáo dục." },
      { en: "A good teacher can change a student's life.", vi: "Một giáo viên giỏi có thể thay đổi cuộc đời học sinh." },
    ],
    trap: { wrong: "Government should invest in education system.", right: "The government should invest in the education system.", note_vi: "Tiếng Việt không có mạo từ, nên người Việt thường bỏ 'the' và 'a'." },
  },
  {
    slug: "generic-statements", phase: 1, sort: 8,
    title: "Generic statements", title_vi: "Câu nói khái quát",
    error_codes: ["ART", "PLU"],
    rule_en: "To talk about a whole group, use a plural noun with no article (Smartphones are useful; Teachers deserve higher pay) or an uncountable noun (Technology changes quickly). Avoid 'The smartphone is…' or a singular noun with no article.",
    rule_vi: "Để nói về cả một nhóm, dùng danh từ số nhiều không mạo từ (Smartphones are...) hoặc danh từ không đếm được. Tránh dùng danh từ số ít không có mạo từ.",
    examples: [
      { en: "Children learn languages faster than adults.", vi: "Trẻ em học ngôn ngữ nhanh hơn người lớn." },
      { en: "Homework helps students remember lessons.", vi: "Bài tập về nhà giúp học sinh nhớ bài." },
    ],
    trap: { wrong: "Smartphone is useful for student.", right: "Smartphones are useful for students.", note_vi: "Tiếng Việt nói 'điện thoại thông minh hữu ích cho học sinh' không cần số nhiều; tiếng Anh nói khái quát phải dùng số nhiều." },
  },
  {
    slug: "missing-be", phase: 1, sort: 9,
    title: "Missing 'to be'", title_vi: "Thiếu động từ 'to be'",
    error_codes: ["BE"],
    rule_en: "English adjectives are not verbs. A sentence with an adjective or a noun after the subject needs a form of be: The city is very crowded. Students are busy. The exam was difficult.",
    rule_vi: "Tính từ tiếng Anh không phải động từ. Câu có tính từ hoặc danh từ sau chủ ngữ cần động từ 'be': The city is crowded.",
    examples: [
      { en: "Public schools are free in many countries.", vi: "Trường công miễn phí ở nhiều nước." },
      { en: "The test was harder than we expected.", vi: "Bài kiểm tra khó hơn chúng tôi nghĩ." },
    ],
    trap: { wrong: "The city very crowded.", right: "The city is very crowded.", note_vi: "Tiếng Việt nói 'Thành phố rất đông' không cần 'là', nhưng tiếng Anh bắt buộc có 'is'." },
  },
  // ---------------- Phase 2: Forms ----------------
  {
    slug: "gerund-infinitive", phase: 2, sort: 10,
    title: "Gerund vs to-infinitive after verbs", title_vi: "Danh động từ và động từ nguyên mẫu có 'to'",
    error_codes: ["VFM"],
    rule_en: "Some verbs take -ing (enjoy, avoid, stop, consider, suggest). Others take to + verb (want, decide, plan, hope, need, refuse). After prepositions always use -ing (interested in learning, good at speaking).",
    rule_vi: "Một số động từ đi với -ing (enjoy, avoid, stop, suggest). Một số đi với to + V (want, decide, plan, hope). Sau giới từ luôn dùng -ing.",
    examples: [
      { en: "Many students avoid asking questions in class.", vi: "Nhiều học sinh tránh đặt câu hỏi trong lớp." },
      { en: "She decided to study medicine.", vi: "Cô ấy quyết định học y." },
    ],
    trap: { wrong: "I like dance. He stopped smoke.", right: "I like dancing. He stopped smoking.", note_vi: "Tiếng Việt không có dạng -ing hay 'to', động từ đứng cạnh nhau ('thích nhảy'), nên dễ bỏ quên." },
  },
  {
    slug: "modals-base", phase: 2, sort: 11,
    title: "Modals + base verb", title_vi: "Động từ khuyết thiếu + động từ nguyên mẫu",
    error_codes: ["VFM"],
    rule_en: "After can, could, should, must, may, might and will, use the base verb with no to and no -s: Students should read more. The school can provide support. Not: can to play, should reads.",
    rule_vi: "Sau can, should, must, may, will dùng động từ nguyên mẫu không 'to', không thêm -s.",
    examples: [
      { en: "Schools should teach practical skills.", vi: "Trường học nên dạy kỹ năng thực tế." },
      { en: "Online courses can reach students in remote areas.", vi: "Khóa học trực tuyến có thể đến với học sinh vùng xa." },
    ],
    trap: { wrong: "He can to play the guitar.", right: "He can play the guitar.", note_vi: "Người học hay thêm 'to' vì nhớ 'want to', nhưng sau động từ khuyết thiếu không có 'to'." },
  },
  {
    slug: "word-families", phase: 2, sort: 12,
    title: "Word families and suffixes", title_vi: "Họ từ và hậu tố",
    error_codes: ["WFM"],
    rule_en: "Choose the right form for the job: noun after an article or adjective (-tion, -ment, -ness), adjective before a noun or after be (-ive, -ful, -al), adverb to describe a verb or adjective (-ly). economy → economic → economically.",
    rule_vi: "Chọn đúng dạng từ: danh từ sau mạo từ/tính từ (-tion, -ment), tính từ trước danh từ hoặc sau 'be' (-ive, -ful, -al), trạng từ bổ nghĩa cho động từ (-ly).",
    examples: [
      { en: "Education has a strong effect on income.", vi: "Giáo dục ảnh hưởng mạnh đến thu nhập." },
      { en: "The economy grew rapidly last year.", vi: "Nền kinh tế tăng trưởng nhanh năm ngoái." },
    ],
    trap: { wrong: "an independence worker; she sings beautiful", right: "an independent worker; she sings beautifully", note_vi: "Trong tiếng Việt một từ có thể làm danh từ, tính từ hay trạng từ mà không đổi hình thức." },
  },
  {
    slug: "dependent-prepositions", phase: 2, sort: 13,
    title: "Dependent prepositions", title_vi: "Giới từ đi kèm",
    error_codes: ["PRP"],
    rule_en: "Many verbs, adjectives and nouns take a fixed preposition: depend on, focus on, interested in, responsible for, an increase in (something), increase by (an amount) / to (a level). Learn them as chunks.",
    rule_vi: "Nhiều động từ, tính từ, danh từ đi với giới từ cố định: depend on, interested in, responsible for, increase by/to. Hãy học thành cụm.",
    examples: [
      { en: "Success depends on hard work.", vi: "Thành công phụ thuộc vào sự chăm chỉ." },
      { en: "Fees increased by 10% to $5,000.", vi: "Học phí tăng 10% lên 5.000 đô la." },
    ],
    trap: { wrong: "It depends of the student.", right: "It depends on the student.", note_vi: "'Phụ thuộc vào' dịch từng chữ dễ thành 'depend in/of'; hãy nhớ cụm 'depend on'." },
  },
  {
    slug: "time-place-prepositions", phase: 2, sort: 14,
    title: "Time and place prepositions", title_vi: "Giới từ chỉ thời gian và nơi chốn",
    error_codes: ["PRP"],
    rule_en: "Time: at + clock time, on + day/date, in + month/year/period; since + a starting point, for + a length. Place: at + a point (at school), in + an enclosed space or city (in Hanoi), on + a surface or street (on Le Loi Street).",
    rule_vi: "Thời gian: at + giờ, on + ngày, in + tháng/năm; since + mốc, for + khoảng. Nơi chốn: at + điểm, in + không gian/thành phố, on + bề mặt/đường.",
    examples: [
      { en: "Classes start at 7 a.m. on Monday.", vi: "Lớp học bắt đầu lúc 7 giờ sáng thứ Hai." },
      { en: "She has studied in Melbourne since March.", vi: "Cô ấy đã học ở Melbourne từ tháng Ba." },
    ],
    trap: { wrong: "I have studied English from last month.", right: "I have studied English since last month.", note_vi: "'Từ tháng trước' dịch thành 'from' là sai khi nói đến hiện tại; dùng 'since'." },
  },
  // ---------------- Phase 3: Complex sentences ----------------
  {
    slug: "relative-clauses", phase: 3, sort: 15,
    title: "Defining and non-defining relative clauses", title_vi: "Mệnh đề quan hệ xác định và không xác định",
    error_codes: ["WOR"],
    rule_en: "Use who for people, which for things, that in defining clauses, whose for possession. A non-defining clause adds extra information between commas and never uses that. Do not repeat the object: the book which I read (not the book which I read it).",
    rule_vi: "Who cho người, which cho vật, whose chỉ sở hữu. Mệnh đề không xác định đặt giữa dấu phẩy và không dùng 'that'. Không lặp lại tân ngữ trong mệnh đề.",
    examples: [
      { en: "Students who study abroad often become more independent.", vi: "Sinh viên du học thường trở nên tự lập hơn." },
      { en: "Hanoi, which is the capital, has many universities.", vi: "Hà Nội, thủ đô, có nhiều trường đại học." },
    ],
    trap: { wrong: "The teacher who I met her yesterday is kind.", right: "The teacher who I met yesterday is kind.", note_vi: "Tiếng Việt có thể nói 'người mà tôi gặp cô ấy', nhưng tiếng Anh không lặp lại 'her'." },
  },
  {
    slug: "conditionals", phase: 3, sort: 16,
    title: "Conditionals 0, 1 and 2", title_vi: "Câu điều kiện loại 0, 1, 2",
    error_codes: ["TNS"],
    rule_en: "Zero: If + present, present (facts). First: If + present, will + verb (real future). Second: If + past, would + verb (unreal or unlikely). Never use will in the if-clause.",
    rule_vi: "Loại 0: If + hiện tại, hiện tại. Loại 1: If + hiện tại, will + V. Loại 2: If + quá khứ, would + V (không có thật). Không dùng 'will' trong mệnh đề if.",
    examples: [
      { en: "If students sleep well, they remember more.", vi: "Nếu học sinh ngủ đủ, các em nhớ bài tốt hơn." },
      { en: "If schools were smaller, teachers would know every student.", vi: "Nếu trường nhỏ hơn, giáo viên sẽ biết mọi học sinh." },
    ],
    trap: { wrong: "If I will have time, I will help you.", right: "If I have time, I will help you.", note_vi: "Tiếng Việt nói 'Nếu tôi sẽ có thời gian' nghe vẫn ổn, nhưng tiếng Anh không dùng 'will' sau 'if'." },
  },
  {
    slug: "concession", phase: 3, sort: 17,
    title: "Concession without doubled connectors", title_vi: "Câu nhượng bộ không dùng thừa liên từ",
    error_codes: ["CNJ"],
    rule_en: "Although/even though + clause; despite/in spite of + noun or -ing; however starts a new sentence and is followed by a comma. Use only one connector: Although it is cheap, it is bad (no but).",
    rule_vi: "Although + mệnh đề; despite + danh từ/V-ing; however đứng đầu câu mới, sau có dấu phẩy. Chỉ dùng một liên từ: không dùng 'Although... but'.",
    examples: [
      { en: "Although online classes are flexible, some students feel lonely.", vi: "Mặc dù lớp trực tuyến linh hoạt, một số học sinh cảm thấy cô đơn." },
      { en: "Despite the high cost, many families pay for private tutors.", vi: "Dù chi phí cao, nhiều gia đình vẫn thuê gia sư." },
    ],
    trap: { wrong: "Although it is cheap, but it is bad.", right: "Although it is cheap, it is bad.", note_vi: "'Mặc dù… nhưng' là cặp trong tiếng Việt, nhưng tiếng Anh chỉ dùng một trong hai." },
  },
  {
    slug: "passive", phase: 3, sort: 18,
    title: "Passive voice (present, past, modals)", title_vi: "Câu bị động (hiện tại, quá khứ, động từ khuyết thiếu)",
    error_codes: ["PSV"],
    rule_en: "Passive = be + past participle. Present: is/are built. Past: was/were built. Modal: should be built. Use it when the action matters more than who did it. Do not drop be: The bridge was built in 2010.",
    rule_vi: "Bị động = be + quá khứ phân từ. Hiện tại: is/are + V3; quá khứ: was/were + V3; với động từ khuyết thiếu: should be + V3. Không được bỏ 'be'.",
    examples: [
      { en: "English is taught in every school.", vi: "Tiếng Anh được dạy ở mọi trường." },
      { en: "More money should be spent on teacher training.", vi: "Nên chi nhiều tiền hơn cho đào tạo giáo viên." },
    ],
    trap: { wrong: "The bridge built in 2010.", right: "The bridge was built in 2010.", note_vi: "Tiếng Việt nói 'Cây cầu xây năm 2010' không cần 'được', nên người Việt hay bỏ 'was'." },
  },
  {
    slug: "cause-effect", phase: 3, sort: 19,
    title: "Cause and effect", title_vi: "Nguyên nhân và kết quả",
    error_codes: ["CNJ"],
    rule_en: "Because/since/as + clause; because of/due to + noun phrase; therefore/as a result start a new sentence or follow a semicolon. Use one connector only: Because it rained, we stayed home (not Because…so).",
    rule_vi: "Because + mệnh đề; because of/due to + cụm danh từ; therefore/as a result bắt đầu câu mới. Không dùng 'Because… so' cùng lúc.",
    examples: [
      { en: "Due to rising costs, some students leave university early.", vi: "Do chi phí tăng, một số sinh viên bỏ đại học sớm." },
      { en: "Classes are large. As a result, teachers cannot help everyone.", vi: "Lớp học đông. Vì vậy giáo viên không thể giúp mọi người." },
    ],
    trap: { wrong: "Because the fee is high, so many students cannot attend.", right: "Because the fee is high, many students cannot attend.", note_vi: "'Vì… nên' là cặp trong tiếng Việt, nhưng tiếng Anh chỉ dùng 'because' hoặc 'so'." },
  },
  {
    slug: "comparatives", phase: 3, sort: 20,
    title: "Comparatives and superlatives for data", title_vi: "So sánh hơn và so sánh nhất khi mô tả số liệu",
    error_codes: ["WFM"],
    rule_en: "Short adjectives add -er/-est (higher, the highest); long ones use more/most (more expensive). Never use both (more cheaper). Use than after comparatives and the before superlatives: the largest share, twice as high as.",
    rule_vi: "Tính từ ngắn thêm -er/-est; tính từ dài dùng more/most. Không dùng cả hai (more cheaper). Dùng 'than' sau so sánh hơn, 'the' trước so sánh nhất.",
    examples: [
      { en: "Spending on education was higher in 2020 than in 2010.", vi: "Chi tiêu cho giáo dục năm 2020 cao hơn năm 2010." },
      { en: "Science was the most popular subject.", vi: "Khoa học là môn được ưa chuộng nhất." },
    ],
    trap: { wrong: "This course is more cheaper than that one.", right: "This course is cheaper than that one.", note_vi: "Tiếng Việt dùng 'hơn' cho mọi tính từ; tiếng Anh không kết hợp 'more' với '-er'." },
  },
  // ---------------- Phase 4: Sentence craft ----------------
  {
    slug: "comma-splices", phase: 4, sort: 21,
    title: "Comma splices and run-ons", title_vi: "Lỗi nối câu bằng dấu phẩy",
    error_codes: ["CLS"],
    rule_en: "A comma cannot join two full sentences. Use a full stop, a semicolon, or a connector (and, but, so, because, although). However and therefore are not connectors: It rained heavily; however, they went out.",
    rule_vi: "Dấu phẩy không thể nối hai câu hoàn chỉnh. Dùng dấu chấm, dấu chấm phẩy hoặc liên từ. 'However' không phải liên từ nối câu.",
    examples: [
      { en: "Some students prefer online classes; others need a teacher in the room.", vi: "Một số học sinh thích lớp trực tuyến; số khác cần giáo viên trong lớp." },
      { en: "Fees are rising, so many families are worried.", vi: "Học phí tăng nên nhiều gia đình lo lắng." },
    ],
    trap: { wrong: "It rained heavily, however they went out.", right: "It rained heavily; however, they went out.", note_vi: "Tiếng Việt có thể nối nhiều vế bằng dấu phẩy, nhưng tiếng Anh thì không." },
  },
  {
    slug: "noun-phrases", phase: 4, sort: 22,
    title: "Nominalisation and noun phrases", title_vi: "Danh từ hóa và cụm danh từ",
    error_codes: ["WFM", "WOR"],
    rule_en: "Academic writing often turns verbs into nouns: students achieve → student achievement; prices rise → a rise in prices. In English noun phrases, adjectives come before the noun: an environmental issue (not an issue environmental).",
    rule_vi: "Văn học thuật thường biến động từ thành danh từ (achieve → achievement). Trong cụm danh từ tiếng Anh, tính từ đứng trước danh từ.",
    examples: [
      { en: "The rapid growth of online learning has changed schools.", vi: "Sự phát triển nhanh của học trực tuyến đã thay đổi trường học." },
      { en: "Poor attendance leads to low achievement.", vi: "Đi học không đều dẫn đến kết quả thấp." },
    ],
    trap: { wrong: "an issue environmental", right: "an environmental issue", note_vi: "Tiếng Việt đặt tính từ sau danh từ ('vấn đề môi trường'), tiếng Anh thì ngược lại." },
  },
  {
    slug: "hedging", phase: 4, sort: 23,
    title: "Hedging", title_vi: "Cách nói giảm nhẹ, thận trọng",
    error_codes: ["VFM"],
    rule_en: "Avoid absolute claims in IELTS. Use tend to + base verb, may/might/can + base verb, is likely to + base verb, it is possible that + clause. Students tend to learn faster when they are interested.",
    rule_vi: "Tránh khẳng định tuyệt đối. Dùng tend to + V, may/can + V, is likely to + V, it is possible that + mệnh đề.",
    examples: [
      { en: "Children who read often tend to write better.", vi: "Trẻ đọc nhiều thường viết tốt hơn." },
      { en: "Online exams are likely to become more common.", vi: "Thi trực tuyến có khả năng sẽ phổ biến hơn." },
    ],
    trap: { wrong: "Students tend learning faster.", right: "Students tend to learn faster.", note_vi: "Sau 'tend' và 'be likely' luôn là 'to + động từ nguyên mẫu'." },
  },
  {
    slug: "paraphrasing", phase: 4, sort: 24,
    title: "Paraphrasing a prompt sentence", title_vi: "Diễn đạt lại câu đề bài",
    error_codes: ["WFM"],
    rule_en: "Paraphrase by changing words (synonyms), word forms (educate → education) and structure (active → passive, clause → noun phrase). Keep the meaning the same and keep key topic words that have no good synonym.",
    rule_vi: "Diễn đạt lại bằng cách đổi từ đồng nghĩa, đổi dạng từ và đổi cấu trúc câu, nhưng giữ nguyên nghĩa.",
    examples: [
      { en: "Many people think university should be free. → It is widely believed that higher education should be free of charge.", vi: "Nhiều người cho rằng đại học nên miễn phí." },
      { en: "Children spend too much time on screens. → Young people's screen time is excessive.", vi: "Trẻ em dùng màn hình quá nhiều." },
    ],
    trap: { wrong: "Many people think that university should free.", right: "It is widely believed that university should be free.", note_vi: "Khi đổi cấu trúc dễ quên động từ 'be' như trong tiếng Việt." },
  },
];
