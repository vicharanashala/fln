



**1. What is FLN?**



FLN i.e. Foundational Literacy and Numeracy/education is a  open source platform for teachers where they can set  question paper according to the current level of students' understanding  and return with the  exam result with proper diagnosis such that a student leans on concept rather than marks , providing areas required to improve /constructive feedbacks . It helps the teacher to segregate the problem the students' facing in  learning a concept thus help in deciding the approach required to make them understand clearly.



**2. What do you understand by FLN (as a system)?**



FLN works as coordinated system .Following are the breakdowns in different levels



1\) As a student one can authorise giving credible information(Aadhaar) required by the platform, can give test according to their academic level;result is provided interms of  constructive ananlysis and suggestion to improve the weak areas not marks .



2\) As a teacher he/she has to register a student/school using student id/adhar or provide their school id , address,block,district,state such that they can access  personalise student worksheet both in interactive and print level. Teachers can also upload the answer scripts and can obtain personalised interactive  feedback for each answer scripts .



3\) Superadmin Dashboard  contain all the information including student email, school name ,id , district, state , school strength, coordinator id,  etc..  . Once user uploads their school name or registers in the platform , the name gets  added in the school list or gets registered



4)There are classes(academic levels) made , from preschool 1 to class 4 . Different class has different difficulty of question to test out their numeracy accordingly



5\) For certification ,their specific skills (verbal/pictorial/decomposition/numeric operation/pattern recognition) is vividly tested, if the performance or satisfactory in some specific cases then they are allowed the certificate else need to improve and attempt again.

&#x20; 





**3**. **Current State of the Repository — What Has Been Done So Far:**





Frontend: React, TypeScript, Vite, Tailwind.

Backend: Node.js, Express, TypeScript.

Database: MongoDB with local JSON fallback.

Authentication: JWT, bcrypt, role-based access.

AI/OCR: Python services, Gemini, OCR, scan processing.

Features: Student management, role dashboards, personalized worksheets, PDF/OMR generation, scanned-answer evaluation, analytics, certification, and remediation.

Roles: superadmin, Admin, District Admin, Block Admin, School, Teacher, and Volunteer.



**4. Gaps Observed in the Code:**



D1.3 — Q-Matrix: which questions test which skills? \[**FROM THE INTERN-READY LINK**:-https://github.com/vicharanashala/fln/issues/478]



**file path**- fln\\backend\\src\\data



**what's done** - Generated 40 question for testing skills (verbal/pictorial/decomposition/numeric operation/pattern recognition) along with marking th difficulty level as 1.2.3 for easy, medium , hard respectively, provided category to the question like direct/ real world along with representation types  which include symbolic ,verbal, equation completion,fraction,pictorial etc.



**Why it matter**s —To test if a student can identify pattern solve word problems, deduce information and solve problems , along with numerical operation 









5\. **Ideas for the Project:**



**IDEA-1:**

Create math puzzle with time constraint 



**The value it adds**-It trains the brain to stay calm under stress. This builds psychological resilience for timed exams, interviews, and real-life critical decisions.Boosts Working Memory Capacity



**IMPLEMENTATION SKETCH:**

Math Puzzle

├── Puzzle data

│   ├── question

│   ├── answer

│   └── time limit

├── Screen

│   ├── show question and answer input

│   └── display countdown timer

├── Timer

│   ├── start when puzzle begins

│   └── submit when time runs out

├── Check answer

│   ├── correct → show success

│   └── incorrect or timeout → show solution

└── Results

&#x20;   └── save score and completion time



**IDEA-2:**

REWARD THE STUDENT; behavioral achievements: Reward positive habits rather than just high scores: Night Owl / Early Bird: For practicing at consistent times. Perseverance Badge: For successfully completing a test that they previously failed. Speed Demon: For beating a personal time record safely (without guessing). Virtual Economy \& Customization Math Coins: Earned alongside XP. Students can spend this virtual currency in an in-app "Reward Store. "Avatar Shop: Allow users to buy digital clothes, hats, backgrounds, or pets for their profile avatar using their earned coins.



**The value it adds**-It transforms math anxiety into engagement by shifting the focus from dry testing to progression, rewarding effort and consistency to build lasting study habits. Streak maintenance gives a dopamine hits 





**IMPLEMENTATION SKETCH:**



Student completes a math activity

&#x20;       │

&#x20;       ├── Save result: accuracy, time, hints, attempts, timestamp

&#x20;       │

&#x20;       ├── Award XP and Math Coins

&#x20;       │

&#x20;       └── Check achievement rules

&#x20;             ├── Night Owl / Early Bird → consistent practice time

&#x20;             ├── Perseverance → pass a test they previously failed

&#x20;             ├── Speed Demon → beat personal best with accuracy safeguards

&#x20;             └── Streak → practice on consecutive days

&#x20;                        │

&#x20;                        ▼

&#x20;             Show reward and progress update

&#x20;                        │

&#x20;                        ▼

&#x20;             Reward Store

&#x20;             ├── Display available avatar items and coin prices

&#x20;             ├── Check balance when an item is purchased

&#x20;             ├── Deduct coins and add item to inventory

&#x20;             └── Let student equip clothes, hats, backgrounds, or pets





**6. Your Contribution:**





**NEW FEATURE ADDED:**



Added 40 question in *question\_bank\_seed.json* of different representation and leveled the toughness where already 10 question existed .Tested the if the response are accordingly ny running the *check-seed.js* where *,*



**sample question**:  {"question\_id":"QB-041","question":"What is 1/3 of 12?","answer":"4","answer\_type":"number","topic":"Fractions","subtopic":"Find one-third of a quantity","difficulty":2,"source\_level":45,"subskills":\["SK13.10"],"representation":"symbolic","context":"direct"},



**sample answer:**QB-041 | skill=SK13.10 | difficulty=2 | source\_level=45 | representation=symbolic | topic=Fractions | subtopic=Find one-third of a quantity | answer=4 | context=direct | answer\_type=number







