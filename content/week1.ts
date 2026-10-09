// Week 1 (education) reading passages and writing tasks.
// evidence_quote strings are copied exactly from the passage body; the seed
// script converts them to character offsets and fails loudly if one is missing.

export type QuestionSeed = {
  type: "tfng" | "mcq" | "completion" | "headings" | "summary";
  prompt: string;
  options?: string[];
  answer: string;
  accept?: string[];
  evidence_quote: string;
  paraphrase_pairs: [string, string][];
  explain_en: string;
  explain_vi: string;
};

export type PassageSeed = {
  day_index: number;
  grammar_slug: string;
  title: string;
  body: string;
  target_words: string[];
  questions: QuestionSeed[];
};

export const WEEK1_PASSAGES: PassageSeed[] = [
  {
    day_index: 1,
    grammar_slug: "present-simple-continuous",
    title: "What Schools Teach Today",
    target_words: ["compulsory", "attend", "curriculum", "literacy", "enrol", "qualification", "tuition fee", "academic"],
    body: `In most countries, education is compulsory until the age of fourteen or fifteen, and almost every child attends a primary school. The basic curriculum still focuses on reading, writing and mathematics, because literacy remains the foundation of all other learning. However, the content of lessons is changing. These days, many schools are adding coding, financial skills and environmental studies to the curriculum.

At the same time, more young people are staying in education for longer. A growing number of students enrol at university or college after finishing high school, as employers increasingly ask for a formal qualification. This trend has a cost. Tuition fees at many universities are rising, and some families are taking out loans to pay them. Experts disagree about whether a degree is always worth the money. Some argue that strong academic results open doors to better jobs, while others point out that practical experience matters just as much in many careers.`,
    questions: [
      {
        type: "tfng",
        prompt: "In most countries, children must stay in education until around the age of fifteen.",
        answer: "TRUE",
        evidence_quote: "In most countries, education is compulsory until the age of fourteen or fifteen",
        paraphrase_pairs: [["must stay in education", "education is compulsory"], ["around the age of fifteen", "until the age of fourteen or fifteen"]],
        explain_en: "'Compulsory' means children must attend, and 'fourteen or fifteen' matches 'around fifteen'.",
        explain_vi: "'Compulsory' nghĩa là bắt buộc, và 'fourteen or fifteen' khớp với 'khoảng mười lăm tuổi'.",
      },
      {
        type: "tfng",
        prompt: "Coding has replaced mathematics in many schools.",
        answer: "FALSE",
        evidence_quote: "These days, many schools are adding coding, financial skills and environmental studies to the curriculum.",
        paraphrase_pairs: [["replaced", "are adding"]],
        explain_en: "Schools are adding coding; the passage says the curriculum still focuses on mathematics, so it was not replaced.",
        explain_vi: "Trường học đang thêm môn lập trình; bài đọc nói chương trình vẫn tập trung vào toán, nên không phải là thay thế.",
      },
      {
        type: "mcq",
        prompt: "Why are more students going to university or college?",
        options: [
          "Because tuition fees are falling",
          "Because employers increasingly want a formal qualification",
          "Because high schools require it",
          "Because degrees are always worth the money",
        ],
        answer: "Because employers increasingly want a formal qualification",
        evidence_quote: "as employers increasingly ask for a formal qualification",
        paraphrase_pairs: [["want", "ask for"]],
        explain_en: "The reason given is that employers increasingly ask for a formal qualification.",
        explain_vi: "Lý do là nhà tuyển dụng ngày càng yêu cầu bằng cấp chính thức.",
      },
      {
        type: "completion",
        prompt: "Some families are taking out ______ to pay university fees. (NO MORE THAN TWO WORDS)",
        answer: "loans",
        evidence_quote: "some families are taking out loans to pay them",
        paraphrase_pairs: [["university fees", "them (tuition fees)"]],
        explain_en: "The passage says families are taking out loans to pay tuition fees.",
        explain_vi: "Bài đọc nói các gia đình vay tiền (loans) để trả học phí.",
      },
    ],
  },
  {
    day_index: 2,
    grammar_slug: "past-simple",
    title: "Changing How Students Are Assessed",
    target_words: ["assess", "rote learning", "achieve", "pressure", "critical thinking", "discipline", "motivation", "extracurricular"],
    body: `For many years, schools in Asia assessed students mainly through written exams. Students memorised facts, and rote learning was the most common way to prepare. This approach achieved high scores in international tests, but it also created heavy pressure on young people.

In the early 2000s, several education systems started to change. Teachers introduced projects, presentations and group work, and they assessed progress throughout the year instead of only at the end. Researchers found that students who worked on projects developed stronger critical thinking skills.

The change was not easy. Some parents worried that standards would fall, and some teachers missed the discipline of the old system. However, surveys showed that motivation increased when students had more choice. Many schools also encouraged extracurricular activities, such as debate clubs and science fairs, which gave students new reasons to enjoy learning.`,
    questions: [
      {
        type: "tfng",
        prompt: "In the past, most Asian schools tested students mainly with written exams.",
        answer: "TRUE",
        evidence_quote: "For many years, schools in Asia assessed students mainly through written exams.",
        paraphrase_pairs: [["In the past", "For many years"], ["tested", "assessed"]],
        explain_en: "'Assessed' means tested, and 'for many years' refers to the past.",
        explain_vi: "'Assessed' nghĩa là đánh giá/kiểm tra, 'for many years' chỉ quá khứ.",
      },
      {
        type: "tfng",
        prompt: "All parents supported the new ways of assessing students.",
        answer: "FALSE",
        evidence_quote: "Some parents worried that standards would fall",
        paraphrase_pairs: [["supported", "worried"]],
        explain_en: "Some parents worried, so not all parents supported the change.",
        explain_vi: "Một số phụ huynh lo lắng, nên không phải tất cả đều ủng hộ.",
      },
      {
        type: "headings",
        prompt: "Choose the best heading for paragraph 2.",
        options: [
          "The problems of memorising facts",
          "A new way of measuring progress",
          "Why parents disliked change",
          "Clubs and competitions",
        ],
        answer: "A new way of measuring progress",
        evidence_quote: "Teachers introduced projects, presentations and group work, and they assessed progress throughout the year instead of only at the end.",
        paraphrase_pairs: [["measuring progress", "assessed progress"], ["new way", "started to change"]],
        explain_en: "Paragraph 2 describes new methods: projects and assessing progress during the year.",
        explain_vi: "Đoạn 2 mô tả cách mới: dự án và đánh giá tiến bộ suốt năm học.",
      },
      {
        type: "completion",
        prompt: "Students who did projects developed stronger ______ skills. (NO MORE THAN TWO WORDS)",
        answer: "critical thinking",
        evidence_quote: "students who worked on projects developed stronger critical thinking skills",
        paraphrase_pairs: [["did projects", "worked on projects"]],
        explain_en: "The passage says project work developed critical thinking skills.",
        explain_vi: "Bài đọc nói làm dự án giúp phát triển kỹ năng tư duy phản biện.",
      },
    ],
  },
  {
    day_index: 3,
    grammar_slug: "present-perfect-past-simple",
    title: "Closing the Education Gap",
    target_words: ["access", "inequality", "remote", "facility", "bridge the gap", "invest", "underprivileged", "scholarship"],
    body: `Access to good schools has improved greatly in the last thirty years, but inequality has not disappeared. In many countries, children in remote areas still walk long distances to class, and their schools often lack basic facilities such as libraries and science labs.

Governments have tried several ways to bridge the gap. Since 2010, many have invested in new school buildings and internet connections in the countryside. Some programmes also provide free lunches, which help underprivileged children to concentrate. Scholarships are another tool. In 2015, one national programme gave scholarships to five thousand students from poor families, and most of them later went to university.

Even so, money alone cannot solve the problem. Good teachers are often unwilling to move to the countryside, so the quality of teaching remains lower there. Experts suggest that rural teachers should receive higher pay and better housing.`,
    questions: [
      {
        type: "tfng",
        prompt: "Schools in remote areas often do not have libraries.",
        answer: "TRUE",
        evidence_quote: "their schools often lack basic facilities such as libraries and science labs.",
        paraphrase_pairs: [["do not have", "lack"]],
        explain_en: "'Lack basic facilities such as libraries' means they do not have libraries.",
        explain_vi: "'Lack' nghĩa là thiếu, tức là không có thư viện.",
      },
      {
        type: "tfng",
        prompt: "Most students in the 2015 scholarship programme studied abroad.",
        answer: "NOT GIVEN",
        evidence_quote: "In 2015, one national programme gave scholarships to five thousand students from poor families, and most of them later went to university.",
        paraphrase_pairs: [["studied abroad", "went to university"]],
        explain_en: "The passage says most went to university, but it never says where. Going to university is not the same as studying abroad.",
        explain_vi: "Bài đọc chỉ nói phần lớn vào đại học, không nói học ở đâu, nên không thể kết luận là du học.",
      },
      {
        type: "summary",
        prompt: "Complete the summary: Since 2010, many governments have ______ in new school buildings and internet connections.",
        options: ["invested", "reduced", "closed", "ignored"],
        answer: "invested",
        evidence_quote: "Since 2010, many have invested in new school buildings and internet connections in the countryside.",
        paraphrase_pairs: [["governments", "many (governments)"]],
        explain_en: "The passage says governments have invested in buildings and internet connections.",
        explain_vi: "Bài đọc nói chính phủ đã đầu tư vào trường học và kết nối internet.",
      },
      {
        type: "completion",
        prompt: "Experts say rural teachers should get higher pay and better ______. (NO MORE THAN TWO WORDS)",
        answer: "housing",
        evidence_quote: "rural teachers should receive higher pay and better housing",
        paraphrase_pairs: [["get", "receive"]],
        explain_en: "The suggestion is higher pay and better housing.",
        explain_vi: "Đề xuất là lương cao hơn và nhà ở tốt hơn.",
      },
    ],
  },
  {
    day_index: 4,
    grammar_slug: "future-forms",
    title: "Problems in City Schools",
    target_words: ["overcrowded", "workload", "shortage", "dropout", "tackle", "allocate", "funding", "vocational"],
    body: `City schools face a different set of problems. Because many families move to cities for work, classrooms are often overcrowded, with fifty or more students in one room. Teachers have a heavy workload, and there is a shortage of experienced staff in fast-growing districts.

These problems affect results. When classes are large, teachers cannot give each student enough attention, and weaker students may fall behind. Some of them eventually become dropouts.

Local governments are planning several changes to tackle the situation. Next year, one city is going to open twelve new schools, and officials say they will allocate more funding to teacher training. Planners also expect that vocational schools will attract more students, because these schools offer practical skills and a direct route into work. If the plans succeed, class sizes will fall over the next five years.`,
    questions: [
      {
        type: "tfng",
        prompt: "City classrooms often hold at least fifty students.",
        answer: "TRUE",
        evidence_quote: "classrooms are often overcrowded, with fifty or more students in one room",
        paraphrase_pairs: [["at least fifty", "fifty or more"]],
        explain_en: "'Fifty or more' means at least fifty.",
        explain_vi: "'Fifty or more' nghĩa là ít nhất năm mươi.",
      },
      {
        type: "tfng",
        prompt: "The twelve new schools will be built in the city centre.",
        answer: "NOT GIVEN",
        evidence_quote: "Next year, one city is going to open twelve new schools",
        paraphrase_pairs: [["will be built", "is going to open"]],
        explain_en: "The passage says twelve schools will open but does not say where in the city they will be.",
        explain_vi: "Bài đọc nói sẽ mở 12 trường nhưng không nói ở khu vực nào của thành phố.",
      },
      {
        type: "mcq",
        prompt: "Why do planners expect vocational schools to become more popular?",
        options: [
          "They are cheaper than universities",
          "They offer practical skills and a direct route into work",
          "They have smaller classes",
          "The government requires students to attend them",
        ],
        answer: "They offer practical skills and a direct route into work",
        evidence_quote: "because these schools offer practical skills and a direct route into work.",
        paraphrase_pairs: [["become more popular", "attract more students"]],
        explain_en: "The reason given is practical skills and a direct route into work.",
        explain_vi: "Lý do là trường nghề dạy kỹ năng thực tế và dẫn thẳng vào công việc.",
      },
      {
        type: "completion",
        prompt: "Officials will allocate more funding to teacher ______. (NO MORE THAN TWO WORDS)",
        answer: "training",
        evidence_quote: "they will allocate more funding to teacher training",
        paraphrase_pairs: [["Officials", "they"]],
        explain_en: "More funding will go to teacher training.",
        explain_vi: "Kinh phí sẽ được phân bổ cho đào tạo giáo viên.",
      },
    ],
  },
  {
    day_index: 5,
    grammar_slug: "sva-long-subjects",
    title: "Learning Online",
    target_words: ["flexible", "beneficial", "lifelong learning", "drawback", "interaction", "distraction", "self-study", "outweigh"],
    body: `Online learning has grown quickly, and the number of people who study through the internet is still rising. One reason is that online courses are flexible. A student who works during the day can watch lectures at night, and adults can return to education without leaving their jobs. This makes online learning especially beneficial for lifelong learning.

However, there are clear drawbacks. The lack of face-to-face interaction means that students miss the support of classmates, and many say they feel isolated. Distraction is another problem: a phone or a game is always only one click away. Research suggests that each student who succeeds online has strong self-study habits.

For most learners, the best choice may be a mix of both. In blended courses, students meet a teacher regularly but complete much of the work online. Many educators believe the benefits of this model outweigh its drawbacks.`,
    questions: [
      {
        type: "tfng",
        prompt: "Online courses allow people with day jobs to study in the evening.",
        answer: "TRUE",
        evidence_quote: "A student who works during the day can watch lectures at night",
        paraphrase_pairs: [["people with day jobs", "A student who works during the day"], ["in the evening", "at night"]],
        explain_en: "Someone who works during the day can watch lectures at night.",
        explain_vi: "Người làm việc ban ngày có thể xem bài giảng vào buổi tối.",
      },
      {
        type: "tfng",
        prompt: "Online learners usually get better grades than classroom learners.",
        answer: "NOT GIVEN",
        evidence_quote: "Research suggests that each student who succeeds online has strong self-study habits.",
        paraphrase_pairs: [["better grades", "succeeds"]],
        explain_en: "The passage talks about what successful online students have in common, but never compares their grades with classroom students.",
        explain_vi: "Bài đọc nói về đặc điểm của người học trực tuyến thành công, nhưng không so sánh điểm số với học sinh học trên lớp.",
      },
      {
        type: "mcq",
        prompt: "What is a blended course?",
        options: [
          "A course with no teacher",
          "A course where students meet a teacher regularly but do much of the work online",
          "A course only for adults",
          "A free online course",
        ],
        answer: "A course where students meet a teacher regularly but do much of the work online",
        evidence_quote: "In blended courses, students meet a teacher regularly but complete much of the work online.",
        paraphrase_pairs: [["do much of the work", "complete much of the work"]],
        explain_en: "Blended courses combine regular meetings with a teacher and online work.",
        explain_vi: "Khóa học kết hợp gồm gặp giáo viên thường xuyên và làm phần lớn bài trực tuyến.",
      },
      {
        type: "completion",
        prompt: "Online students miss the support of their ______. (NO MORE THAN TWO WORDS)",
        answer: "classmates",
        evidence_quote: "students miss the support of classmates",
        paraphrase_pairs: [["Online students", "students"]],
        explain_en: "Without face-to-face interaction, students miss support from classmates.",
        explain_vi: "Không gặp mặt trực tiếp, học sinh thiếu sự hỗ trợ từ bạn học.",
      },
    ],
  },
];

export type WritingSeed = {
  type: "opinion" | "chart" | "paraphrase" | "problem_solution" | "adv_disadv" | "essay";
  prompt: string;
  min_words: number;
  max_words: number;
  target_words: string[];
  grammar_slug: string;
  chart_data?: { title: string; unit: string; points: { label: string; value: number }[] };
};

export const WEEK1_WRITING: WritingSeed[] = [
  {
    type: "opinion", min_words: 80, max_words: 120, grammar_slug: "present-simple-continuous",
    target_words: ["curriculum", "academic", "compulsory", "qualification"],
    prompt: "Some people think schools should teach only academic subjects such as maths and science. Do you agree? Write one paragraph: give your claim, one reason, and one example.",
  },
  {
    type: "chart", min_words: 60, max_words: 80, grammar_slug: "past-simple",
    target_words: ["achieve", "pressure", "motivation", "assess"],
    prompt: "The chart shows the percentage of secondary students in one country who took at least one online course, 2016–2024. Describe the main trend and compare the figures.",
    chart_data: {
      title: "Students taking an online course (%)",
      unit: "%",
      points: [
        { label: "2016", value: 8 },
        { label: "2018", value: 12 },
        { label: "2020", value: 41 },
        { label: "2022", value: 30 },
        { label: "2024", value: 34 },
      ],
    },
  },
  {
    type: "paraphrase", min_words: 50, max_words: 70, grammar_slug: "present-perfect-past-simple",
    target_words: ["access", "inequality", "underprivileged", "bridge the gap"],
    prompt: "Paraphrase this IELTS prompt in two different ways, then write one introduction sentence: \"Children from poor families do not have the same chance of a good education as children from rich families.\"",
  },
  {
    type: "problem_solution", min_words: 80, max_words: 120, grammar_slug: "future-forms",
    target_words: ["overcrowded", "shortage", "tackle", "funding"],
    prompt: "Many city schools have overcrowded classrooms. Explain one problem this causes and suggest one solution.",
  },
  {
    type: "adv_disadv", min_words: 80, max_words: 120, grammar_slug: "sva-long-subjects",
    target_words: ["flexible", "drawback", "interaction", "distraction"],
    prompt: "Write a paragraph on the advantages and disadvantages of studying online instead of in a classroom.",
  },
  {
    type: "essay", min_words: 150, max_words: 200, grammar_slug: "articles",
    target_words: ["tuition fee", "invest", "beneficial", "outweigh"],
    prompt: "Some people believe that university education should be free for everyone. Others think students should pay for their own studies. Discuss both views and give your own opinion.",
  },
];
