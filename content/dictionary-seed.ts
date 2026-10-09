// Starter dictionary so lookups work before the Wiktionary build script runs
// (scripts/build-dictionary.ts replaces/extends this with ~30–40k rows).
// Format: lemma | pos | IPA | Vietnamese glosses (;) | learner definition | example

export const DICTIONARY_SEED = `
pollution|noun|/pəˈluːʃn/|ô nhiễm;sự ô nhiễm|harmful substances in air, water or land|Air pollution is a serious problem in big cities.
pollute|verb|/pəˈluːt/|làm ô nhiễm|to make air, water or land dirty and harmful|Factories pollute the river.
environment|noun|/ɪnˈvaɪrənmənt/|môi trường|the natural world of land, air, water, plants and animals|We must protect the environment.
environmental|adjective|/ɪnˌvaɪrənˈmentl/|thuộc về môi trường|connected with the natural world|Plastic waste is an environmental issue.
climate|noun|/ˈklaɪmət/|khí hậu|the usual weather in a place|The climate is changing quickly.
recycle|verb|/ˌriːˈsaɪkl/|tái chế|to treat used things so they can be used again|We recycle paper and glass.
waste|noun|/weɪst/|rác thải;sự lãng phí|things that are thrown away; using something badly|Plastic waste ends up in the sea.
energy|noun|/ˈenədʒi/|năng lượng|power from electricity, fuel, etc.; strength to be active|Solar energy is cheap and clean.
renewable|adjective|/rɪˈnjuːəbl/|tái tạo được|that can be replaced naturally|Wind is a renewable source of energy.
traffic|noun|/ˈtræfɪk/|giao thông;xe cộ|the vehicles on a road|The traffic is heavy in the morning.
congestion|noun|/kənˈdʒestʃən/|tắc nghẽn|too many vehicles on the roads|Traffic congestion wastes time.
government|noun|/ˈɡʌvənmənt/|chính phủ|the group of people who control a country|The government should invest in schools.
education|noun|/ˌedʒuˈkeɪʃn/|giáo dục;sự giáo dục|teaching and learning, especially in schools|Education is the key to a good future.
educate|verb|/ˈedʒukeɪt/|giáo dục;dạy dỗ|to teach someone over a long time|Parents educate their children at home too.
student|noun|/ˈstjuːdnt/|học sinh;sinh viên|a person who studies at a school or university|Every student has a laptop.
teacher|noun|/ˈtiːtʃə(r)/|giáo viên|a person whose job is teaching|My teacher explains grammar clearly.
school|noun|/skuːl/|trường học|a place where children go to learn|The school opens at 7 a.m.
university|noun|/ˌjuːnɪˈvɜːsəti/|trường đại học|a place where people study for a degree|She studies at a university in Hanoi.
knowledge|noun|/ˈnɒlɪdʒ/|kiến thức;hiểu biết|information and understanding you have|Reading increases your knowledge.
information|noun|/ˌɪnfəˈmeɪʃn/|thông tin|facts about something|The website gives useful information.
advice|noun|/ədˈvaɪs/|lời khuyên|an opinion about what someone should do|Can you give me some advice?
skill|noun|/skɪl/|kỹ năng|the ability to do something well|Writing is an important skill.
increase|verb|/ɪnˈkriːs/|tăng;gia tăng|to become or make bigger in number or amount|Prices increased by 10%.
decrease|verb|/dɪˈkriːs/|giảm|to become or make smaller in number or amount|The number of visitors decreased.
rise|verb|/raɪz/|tăng lên;mọc lên|to go up or increase|Fees rose sharply in 2020.
decline|verb|/dɪˈklaɪn/|suy giảm;từ chối|to become smaller or worse|Sales declined last year.
significant|adjective|/sɪɡˈnɪfɪkənt/|đáng kể;quan trọng|large or important enough to notice|There was a significant increase in prices.
sharply|adverb|/ˈʃɑːpli/|mạnh;đột ngột|suddenly and by a large amount|Fees rose sharply.
gradually|adverb|/ˈɡrædʒuəli/|dần dần|slowly over time|The number gradually increased.
trend|noun|/trend/|xu hướng|a general change in a direction|There is a trend towards online learning.
issue|noun|/ˈɪʃuː/|vấn đề|an important problem people discuss|Pollution is a serious issue.
problem|noun|/ˈprɒbləm/|vấn đề;khó khăn|something difficult to deal with|Traffic is a big problem.
solution|noun|/səˈluːʃn/|giải pháp|a way to solve a problem|We need a solution to traffic jams.
solve|verb|/sɒlv/|giải quyết|to find an answer to a problem|Money alone cannot solve the problem.
cause|verb|/kɔːz/|gây ra|to make something happen|Smoking causes disease.
effect|noun|/ɪˈfekt/|ảnh hưởng;tác động|a change that something causes|Technology has a strong effect on children.
affect|verb|/əˈfekt/|ảnh hưởng đến|to produce a change in something|Noise affects sleep.
benefit|noun|/ˈbenɪfɪt/|lợi ích|an advantage or good effect|Exercise has many benefits.
advantage|noun|/ədˈvɑːntɪdʒ/|lợi thế;ưu điểm|something that helps you|One advantage of the city is good transport.
disadvantage|noun|/ˌdɪsədˈvɑːntɪdʒ/|bất lợi;nhược điểm|something that causes problems|The main disadvantage is the cost.
opportunity|noun|/ˌɒpəˈtjuːnəti/|cơ hội|a chance to do something|Studying abroad is a great opportunity.
society|noun|/səˈsaɪəti/|xã hội|people living together in a community|Technology changes society.
community|noun|/kəˈmjuːnəti/|cộng đồng|the people living in one area|The community built a new library.
technology|noun|/tekˈnɒlədʒi/|công nghệ|scientific knowledge used in practical ways|Technology makes life easier.
device|noun|/dɪˈvaɪs/|thiết bị|a machine or tool made for a purpose|Phones are useful devices.
internet|noun|/ˈɪntənet/|mạng internet|the global computer network|The internet gives access to information.
health|noun|/helθ/|sức khỏe|the condition of your body and mind|Sleep is important for health.
healthy|adjective|/ˈhelθi/|khỏe mạnh;tốt cho sức khỏe|good for your body; not ill|Fruit is a healthy snack.
disease|noun|/dɪˈziːz/|bệnh tật|an illness|Heart disease is common.
obesity|noun|/əʊˈbiːsəti/|béo phì|being very overweight in an unhealthy way|Obesity is rising among children.
diet|noun|/ˈdaɪət/|chế độ ăn|the food you usually eat|A balanced diet keeps you healthy.
exercise|noun|/ˈeksəsaɪz/|tập thể dục;bài tập|physical activity to stay healthy|Daily exercise is important.
employment|noun|/ɪmˈplɔɪmənt/|việc làm|having a paid job|Employment rates have improved.
unemployment|noun|/ˌʌnɪmˈplɔɪmənt/|thất nghiệp|not having a job|Unemployment is high among young people.
salary|noun|/ˈsæləri/|lương|money paid for a job, usually monthly|Teachers deserve a higher salary.
career|noun|/kəˈrɪə(r)/|sự nghiệp;nghề nghiệp|the jobs you do during your working life|She wants a career in medicine.
city|noun|/ˈsɪti/|thành phố|a large town|Hanoi is a busy city.
crowded|adjective|/ˈkraʊdɪd/|đông đúc|full of people|The bus was very crowded.
housing|noun|/ˈhaʊzɪŋ/|nhà ở|buildings for people to live in|Housing is expensive in big cities.
rent|noun|/rent/|tiền thuê nhà|money paid to live in a place you do not own|The rent is too high.
crime|noun|/kraɪm/|tội phạm;tội ác|an illegal action|Crime has fallen in our area.
punishment|noun|/ˈpʌnɪʃmənt/|hình phạt|a penalty for doing something wrong|Prison is a common punishment.
law|noun|/lɔː/|luật pháp|the system of rules of a country|Everyone must obey the law.
media|noun|/ˈmiːdiə/|truyền thông|TV, newspapers, the internet, etc.|The media influences young people.
advertising|noun|/ˈædvətaɪzɪŋ/|quảng cáo|telling people about products to sell them|Advertising targets children.
influence|verb|/ˈɪnfluəns/|ảnh hưởng|to change how someone thinks or acts|Friends influence our choices.
culture|noun|/ˈkʌltʃə(r)/|văn hóa|the customs and beliefs of a group|Travel helps us learn about culture.
tradition|noun|/trəˈdɪʃn/|truyền thống|a custom passed down over time|Tet is an important tradition.
tourism|noun|/ˈtʊərɪzəm/|du lịch|the business of providing holidays|Tourism brings money to the region.
tourist|noun|/ˈtʊərɪst/|khách du lịch|a person visiting a place for pleasure|Many tourists visit Hoi An.
food|noun|/fuːd/|thức ăn;thực phẩm|things people or animals eat|Street food is cheap and tasty.
agriculture|noun|/ˈæɡrɪkʌltʃə(r)/|nông nghiệp|farming|Agriculture employs many people.
farmer|noun|/ˈfɑːmə(r)/|nông dân|a person who owns or works on a farm|Farmers grow rice.
family|noun|/ˈfæməli/|gia đình|parents and their children|My family eats dinner together.
parent|noun|/ˈpeərənt/|cha mẹ;phụ huynh|a mother or father|Parents should read to their children.
elderly|adjective|/ˈeldəli/|cao tuổi|old|Elderly people need care.
generation|noun|/ˌdʒenəˈreɪʃn/|thế hệ|people born at about the same time|The young generation uses phones a lot.
globalisation|noun|/ˌɡləʊbəlaɪˈzeɪʃn/|toàn cầu hóa|countries becoming more connected through trade and culture|Globalisation has changed our economy.
economy|noun|/ɪˈkɒnəmi/|nền kinh tế|the system of money, trade and industry|The economy grew last year.
economic|adjective|/ˌiːkəˈnɒmɪk/|thuộc về kinh tế|connected with the economy|Economic growth creates jobs.
develop|verb|/dɪˈveləp/|phát triển|to grow or make something grow|Children develop quickly.
development|noun|/dɪˈveləpmənt/|sự phát triển|the process of growing or changing|Economic development takes time.
improve|verb|/ɪmˈpruːv/|cải thiện|to make or become better|Practice improves your English.
reduce|verb|/rɪˈdjuːs/|giảm bớt|to make smaller or less|We should reduce plastic use.
provide|verb|/prəˈvaɪd/|cung cấp|to give something that is needed|Schools provide free lunches.
require|verb|/rɪˈkwaɪə(r)/|đòi hỏi;yêu cầu|to need something|The job requires a degree.
encourage|verb|/ɪnˈkʌrɪdʒ/|khuyến khích|to give support or confidence|Teachers encourage students to read.
prevent|verb|/prɪˈvent/|ngăn chặn|to stop something from happening|Vaccines prevent disease.
protect|verb|/prəˈtekt/|bảo vệ|to keep safe from harm|Laws protect children.
consider|verb|/kənˈsɪdə(r)/|cân nhắc;xem xét|to think carefully about|Consider both sides of the argument.
believe|verb|/bɪˈliːv/|tin rằng|to think that something is true|I believe education should be free.
argue|verb|/ˈɑːɡjuː/|lập luận;tranh cãi|to give reasons for an opinion; to disagree angrily|Some people argue that tests are unfair.
opinion|noun|/əˈpɪnjən/|ý kiến;quan điểm|what you think about something|In my opinion, homework is useful.
however|adverb|/haʊˈevə(r)/|tuy nhiên|used to show a contrast|It is cheap. However, it is slow.
although|conjunction|/ɔːlˈðəʊ/|mặc dù|despite the fact that|Although it rained, we went out.
therefore|adverb|/ˈðeəfɔː(r)/|vì vậy;do đó|as a result|Classes are big; therefore, teachers are busy.
despite|preposition|/dɪˈspaɪt/|mặc dù;bất chấp|without being affected by something|Despite the rain, we went out.
crucial|adjective|/ˈkruːʃl/|then chốt;cực kỳ quan trọng|extremely important|Sleep is crucial for learning.
essential|adjective|/ɪˈsenʃl/|thiết yếu|completely necessary|Water is essential for life.
expensive|adjective|/ɪkˈspensɪv/|đắt|costing a lot of money|Housing is expensive.
afford|verb|/əˈfɔːd/|có đủ tiền|to have enough money for something|Many families cannot afford tuition fees.
independent|adjective|/ˌɪndɪˈpendənt/|độc lập;tự lập|not needing help from others|Studying abroad makes you independent.
responsible|adjective|/rɪˈspɒnsəbl/|có trách nhiệm|having a duty to deal with something|Parents are responsible for their children.
depend|verb|/dɪˈpend/|phụ thuộc|to be affected by something (depend on)|Success depends on hard work.
focus|verb|/ˈfəʊkəs/|tập trung|to give attention to one thing (focus on)|Focus on your studies.
attention|noun|/əˈtenʃn/|sự chú ý|watching, listening or thinking carefully|Pay attention in class.
behaviour|noun|/bɪˈheɪvjə(r)/|hành vi|the way someone acts|Good behaviour is rewarded.
give up|phrasal verb|/ɡɪv ʌp/|từ bỏ|to stop doing or trying something|Don't give up learning English.
account for|phrasal verb|/əˈkaʊnt fɔː(r)/|chiếm (tỉ lệ);giải thích|to form an amount of something; to explain|Students account for 30% of users.
look after|phrasal verb|/lʊk ˈɑːftə(r)/|chăm sóc|to take care of|She looks after her grandmother.
`;
