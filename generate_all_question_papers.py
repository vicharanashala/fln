import json, os

QUESTION_BANK = {
    # ===== CLASS 1 LEVEL (shared across many syllabi) =====
    "NS_OOC": {"question": "Draw a line to match each object. Left: ☆ ☆ ☆. Right: ○ ○ ○. Match one star to one circle.", "answer": "matched", "answer_type": "text"},
    "NS_CLASS": {"question": "Circle the objects that are big. (Images: big ball, small ball, big book, small pencil)", "answer": "big ball, big book", "answer_type": "text"},
    "NS_SER": {"question": "Arrange these numbers in order from smallest to biggest: 1, 3, 2", "answer": "1, 2, 3", "answer_type": "text"},
    "NS_COUNT": {"question": "Count the stars: ☆☆☆ How many stars are there?", "answer": 3, "answer_type": "numeric"},
    "NS_NRS": {"question": "Write the numbers 1 to 5 in order.", "answer": "1, 2, 3, 4, 5", "answer_type": "text"},
    "NS_ODD": {"question": "Look at the group: Apple, Banana, Chair, Orange. Which one does not belong?", "answer": "Chair", "answer_type": "text"},
    "NS_MATCH": {"question": "Match each shape to its name: Left: ○ △ □, Right: Circle Triangle Square", "answer": "Circle, Triangle, Square", "answer_type": "text"},
    "NS_NR": {"question": "What number is this? (Picture of number 4) Write the number.", "answer": 4, "answer_type": "numeric"},
    "NS_CQ": {"question": "Which group has MORE? Left: ☆☆ (2 stars), Right: ☆☆☆☆☆ (5 stars)", "answer": "Right", "answer_type": "text"},
    "NS_FC": {"question": "Count forward: 1, 2, __, 4, 5. What number is missing?", "answer": 3, "answer_type": "numeric"},
    "NS_ZA": {"question": "If you have 5 balloons and all fly away, how many balloons are left?", "answer": 0, "answer_type": "numeric"},
    "NS_NN5": {"question": "Write the number name for 3.", "answer": "three", "answer_type": "text"},
    "NS_FGC": {"question": "Show 3 fingers. How many fingers are you showing?", "answer": 3, "answer_type": "numeric"},
    "NS_ABB": {"question": "What number comes AFTER 3 in the sequence: 1, 2, 3, _?", "answer": 4, "answer_type": "numeric"},
    "NS_SERP3": {"question": "Arrange by size: (Small ball, Medium ball, Big ball). Write: 1 for smallest, 2 for medium, 3 for biggest.", "answer": "1, 2, 3", "answer_type": "text"},
    "NS_COUNT10": {"question": "Count the stars: ☆☆☆☆☆☆☆☆☆☆ How many stars?", "answer": 10, "answer_type": "numeric"},
    "NS_FCUP9": {"question": "Write the missing number: 9, 8, 7, _, 5", "answer": 6, "answer_type": "numeric"},
    "NS_NW9": {"question": "Write the number 7 in the box.", "answer": 7, "answer_type": "numeric"},
    "NS_NN10": {"question": "Write the number name for 7.", "answer": "seven", "answer_type": "text"},
    "NS_COMPNUM": {"question": "Which is greater? 6 or 9?", "answer": 9, "answer_type": "numeric"},
    "NS_TENS": {"question": "How many tens and ones in 15?", "answer": "1 ten and 5 ones", "answer_type": "text"},
    "NS_N1130": {"question": "Count and write the number: (Picture of 23 objects) How many?", "answer": 23, "answer_type": "numeric"},
    "NS_CNTTRACE": {"question": "Count 12 apples. Trace and write the number 12.", "answer": 12, "answer_type": "numeric"},
    "NS_ABB1130": {"question": "What number comes AFTER 18? 18, __", "answer": 19, "answer_type": "numeric"},
    "NS_ORD30": {"question": "Arrange in ascending order: 25, 12, 30, 18", "answer": "12, 18, 25, 30", "answer_type": "text"},
    "NS_N3150": {"question": "Write the number that comes between 34 and 36.", "answer": 35, "answer_type": "numeric"},
    "NS_SKIP": {"question": "Fill the missing numbers: 2, 4, __, 8, 10 (skip count by 2s)", "answer": 6, "answer_type": "numeric"},
    "NS_CMP50": {"question": "Compare: 34 _ 43. Write >, < or =", "answer": "<", "answer_type": "text"},
    "NS_ORD50": {"question": "Arrange in descending order: 45, 23, 38, 50", "answer": "50, 45, 38, 23", "answer_type": "text"},
    "NO_EAA": {"question": "If you have 2 apples and your friend gives you 1 more, how many apples do you have?", "answer": 3, "answer_type": "numeric"},
    "NO_CG": {"question": "Count: ☀☀ (2 suns) + ☀☀☀ (3 suns). How many total suns?", "answer": 5, "answer_type": "numeric"},
    "NO_CG5": {"question": "Add: ★★ (2 stars) + ★★★ (3 stars) = ?", "answer": 5, "answer_type": "numeric"},
    "NO_TA": {"question": "You have 4 candies. You eat 1. How many are left?", "answer": 3, "answer_type": "numeric"},
    "NO_CG9": {"question": "Add: ★★★ (3 stars) + ★★★★ (4 stars) = ?", "answer": 7, "answer_type": "numeric"},
    "NO_CGP3": {"question": "Add: ★★★ (3 stars) + ★★★★ (4 stars) = ?", "answer": 7, "answer_type": "numeric"},
    "NO_TAP3": {"question": "There are 8 birds on a tree. 3 fly away. How many birds are still on the tree?", "answer": 5, "answer_type": "numeric"},
    "NO_ADD": {"question": "What is 9 + 5?", "answer": 14, "answer_type": "numeric"},
    "NO_ADD30": {"question": "Add: 14 + 5 = ?", "answer": 19, "answer_type": "numeric"},
    "NO_SUB": {"question": "What is 7 - 3?", "answer": 4, "answer_type": "numeric"},
    "NO_SUB30": {"question": "Subtract: 23 - 4 = ?", "answer": 19, "answer_type": "numeric"},
    "NO_REL": {"question": "If 8 + 5 = 13, what is 13 - 5?", "answer": 8, "answer_type": "numeric"},
    "NO_REPADD": {"question": "How many legs do 3 chairs have? (Each chair has 4 legs) 4 + 4 + 4 = ?", "answer": 12, "answer_type": "numeric"},
    "MON_VOC": {"question": "Which word is related to money? (Pen, Rupee, Book, Chair)", "answer": "Rupee", "answer_type": "text"},
    "MON_COINS": {"question": "Which of these is a coin? (Rs 10 note, Rs 5 coin, Rs 100 note, Rs 20 note)", "answer": "Rs 5 coin", "answer_type": "text"},
    "MON_NOTES": {"question": "What is the value of this note? (Image of Rs 10 note)", "answer": "Rs 10", "answer_type": "text"},
    "MON_REP": {"question": "Show Rs 15 using notes and coins. How many Rs 10 notes and Rs 5 coins?", "answer": "1 note and 1 coin", "answer_type": "text"},
    "MEAS_LEN": {"question": "Which is LONGER? (Picture of a pencil vs a crayon)", "answer": "pencil", "answer_type": "text"},
    "MEAS_WEIGHT": {"question": "Which is HEAVIER? (Picture of a book vs a feather)", "answer": "book", "answer_type": "text"},
    "MEAS_CAP": {"question": "Which glass is FULL? (Picture: one glass full, one empty)", "answer": "the full glass", "answer_type": "text"},
    "MEAS_LENCOMP": {"question": "Who is TALLER? (Picture: a child and a giraffe)", "answer": "giraffe", "answer_type": "text"},
    "MEAS_WTCOMP": {"question": "Which is HEAVIER? An elephant or a mouse?", "answer": "elephant", "answer_type": "text"},
    "MEAS_CAPVOC": {"question": "Which bottle holds MORE water? (Big bottle vs small bottle)", "answer": "big bottle", "answer_type": "text"},
    "MEAS_LENEXT": {"question": "Look at three ribbons: Red (long), Blue (longer), Green (longest). Which is the LONGEST?", "answer": "Green", "answer_type": "text"},
    "MEAS_WTEXT": {"question": "Among a feather, a book, and a table, which is the HEAVIEST?", "answer": "table", "answer_type": "text"},
    "MEAS_CAPCOMP": {"question": "Which jar can hold the most water? (Small cup, Medium mug, Large bucket)", "answer": "Large bucket", "answer_type": "text"},
    "MEAS_LENNS": {"question": "How many paper clips long is this pencil? (Image: pencil = 6 paper clips)", "answer": 6, "answer_type": "numeric"},
    "MEAS_WTNS": {"question": "Which is heavier: a book, a pencil, or a table?", "answer": "table", "answer_type": "text"},
    "MEAS_CAPNS": {"question": "How many cups of water can fill this jug? (Image: jug = 5 cups)", "answer": 5, "answer_type": "numeric"},
    "MEAS_TEMP": {"question": "Is ice cream hot or cold?", "answer": "cold", "answer_type": "text"},
    "SHAPE_BASIC": {"question": "Which shape is a ball? (Circle, Square, Triangle, Rectangle)", "answer": "Circle", "answer_type": "text"},
    "SHAPE_PF": {"question": "A dice has corners. How many corners does a cube have?", "answer": 8, "answer_type": "numeric"},
    "SHAPE_2D": {"question": "How many sides does a square have?", "answer": 4, "answer_type": "numeric"},
    "SHAPE_3D": {"question": "Name a 3D shape that has no corners.", "answer": "sphere", "answer_type": "text"},
    "FRAC_VOC": {"question": "If you cut an apple into 2 equal parts, each part is called _____", "answer": "half", "answer_type": "text"},
    "FRAC_HALF": {"question": "If you fold a paper once and cut, how many equal parts do you get?", "answer": 2, "answer_type": "numeric"},
    "PAT_REP": {"question": "Clap your hands 3 times. Tap your feet 3 times. Repeat. What comes next after clap, clap, clap?", "answer": "tap, tap, tap", "answer_type": "text"},
    "PAT_EXT": {"question": "Complete the pattern: ○△○△○_", "answer": "△", "answer_type": "text"},
    "PAT_CREATE": {"question": "Draw the next shape in the pattern: △□△□△_", "answer": "□", "answer_type": "text"},
    "PAT_TRACE": {"question": "Trace and complete: ☆○☆○☆_", "answer": "○", "answer_type": "text"},
    "PAT_SNP": {"question": "What comes next? 1, 2, 1, 2, 1, _", "answer": "2", "answer_type": "numeric"},
    "DATA_ID": {"question": "How many eyes do you have? Look in the mirror and count.", "answer": 2, "answer_type": "numeric"},
    "DATA_COLLECT": {"question": "Count the number of red objects in your classroom. Write the number.", "answer": 5, "answer_type": "numeric"},
    "DATA_OBS": {"question": "Look at the picture: There are 4 apples and 2 bananas. Which fruit has MORE?", "answer": "apples", "answer_type": "text"},
    "DATA_CI": {"question": "In a picture, 3 children like cricket and 2 like football. Which sport is liked more?", "answer": "cricket", "answer_type": "text"},
    "CAL_DLT": {"question": "If today is Monday, what day was yesterday?", "answer": "Sunday", "answer_type": "text"},
    "CAL_SPECIAL": {"question": "Which day is a holiday? (Monday, Sunday, Wednesday, Friday)", "answer": "Sunday", "answer_type": "text"},
    "CAL_DM": {"question": "How many days are in a week?", "answer": "7", "answer_type": "text"},
    "CAL_DMC1": {"question": "Name the first month of the year.", "answer": "January", "answer_type": "text"},

    # ===== Intermediate missing ones =====
    "NS_COUNT5": {"question": "Count the apples: 🍎🍎🍎🍎🍎 How many apples?", "answer": 5, "answer_type": "numeric"},
    "NS_NR5": {"question": "Look at the number 4. Which number is this? (1, 2, 3, 4, 5)", "answer": 4, "answer_type": "numeric"},
    "NS_CLASSEXT": {"question": "Sort these into two groups: red ball, blue ball, red book, blue book. How many objects are red?", "answer": 2, "answer_type": "numeric"},
    "NS_SEREXT": {"question": "Arrange by height: short plant, tall tree, medium bush, very tall building (write 1, 2, 3, 4)", "answer": "1, 2, 3, 4", "answer_type": "text"},
    "NS_FC9": {"question": "Count forward from 6 to 9.", "answer": "6, 7, 8, 9", "answer_type": "text"},
    "NS_ZERO": {"question": "You have 7 toys. You give away all 7. How many toys do you have now?", "answer": 0, "answer_type": "numeric"},
    "NS_CMP10": {"question": "Which is bigger: 8 or 3?", "answer": 8, "answer_type": "numeric"},
    "NS_CLASS1": {"question": "Look at these: red square, blue circle, red triangle, blue square. How many red shapes are there?", "answer": 2, "answer_type": "numeric"},
    "NS_SER1": {"question": "Arrange these numbers from smallest to largest: 7, 3, 9, 5, 11, 1", "answer": "1, 3, 5, 7, 9, 11", "answer_type": "text"},
    "NS_COUNT20": {"question": "Count: ☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆ How many stars? (20)", "answer": 20, "answer_type": "numeric"},
    "NS_FC20": {"question": "Count backward from 20: 20, 19, 18, __, 16", "answer": 17, "answer_type": "numeric"},
    "NS_NW99": {"question": "Write the number eighty-seven.", "answer": 87, "answer_type": "numeric"},
    "NS_ZERO1": {"question": "7 - 7 = ?", "answer": 0, "answer_type": "numeric"},
    "NS_CMP20": {"question": "Compare: 14 _ 17. Write >, < or =", "answer": "<", "answer_type": "text"},

    # ===== CLASS 2 LEVEL =====
    "NS_PV2D": {"question": "In the number 46, how many tens and how many ones?", "answer": "4 tens and 6 ones", "answer_type": "text"},
    "NS_NUM100": {"question": "Write the number that comes after 99.", "answer": 100, "answer_type": "numeric"},
    "NS_CMP100": {"question": "Compare: 67 _ 76. Write >, < or =", "answer": "<", "answer_type": "text"},
    "NS_ORD100": {"question": "Arrange in ascending order: 45, 23, 67, 12", "answer": "12, 23, 45, 67", "answer_type": "text"},
    "NS_TALLY": {"question": "Count 7 objects using tally marks.", "answer": "|||| ||", "answer_type": "text"},
    "NS_ORDINAL": {"question": "In a race, Rahul came first, Seema came second, and Amit came third. Who came FIRST?", "answer": "Rahul", "answer_type": "text"},
    "NO_ADD100": {"question": "Add: 47 + 25 = ?", "answer": 72, "answer_type": "numeric"},
    "NO_SUB100": {"question": "Subtract: 63 - 28 = ?", "answer": 35, "answer_type": "numeric"},
    "NO_MUL_REP": {"question": "There are 3 groups of 4 apples each. How many apples in total? 3 x 4 = ?", "answer": 12, "answer_type": "numeric"},
    "MEAS_STD": {"question": "A pencil is 15 cm long. A book is 30 cm long. What is longer?", "answer": "book", "answer_type": "text"},
    "TIME_CLOCK": {"question": "What time is shown on the clock? (Image: clock showing 3:00)", "answer": "3 o'clock", "answer_type": "text"},

    # ===== CLASS 3 LEVEL =====
    "NS_EXPAND3": {"question": "Write 345 in expanded form (hundreds + tens + ones).", "answer": "300 + 40 + 5", "answer_type": "text"},
    "NS_CMP1000": {"question": "Compare: 567 _ 657. Write >, < or =", "answer": "<", "answer_type": "text"},
    "NS_ORD1000": {"question": "Arrange in ascending order: 345, 234, 567, 123", "answer": "123, 234, 345, 567", "answer_type": "text"},
    "NO_ADD1000": {"question": "Add: 456 + 389 = ?", "answer": 845, "answer_type": "numeric"},
    "NO_SUB1000": {"question": "Subtract: 723 - 456 = ?", "answer": 267, "answer_type": "numeric"},
    "NO_MUL": {"question": "What is 6 x 7?", "answer": 42, "answer_type": "numeric"},
    "NO_DIV": {"question": "Share 12 candies equally among 3 children. How many candies does each child get?", "answer": 4, "answer_type": "numeric"},
    "MON_TXN": {"question": "You have Rs 100. You buy a book for Rs 75. How much change do you get?", "answer": 25, "answer_type": "numeric"},
    "MEAS_CONV": {"question": "How many centimeters are in 1 meter?", "answer": 100, "answer_type": "numeric"},
    "FRAC_CMP": {"question": "Which is bigger: 1/2 or 1/4?", "answer": "1/2", "answer_type": "text"},
    "DATA_BAR": {"question": "In a bar graph, the bar for apples reaches 5 and the bar for bananas reaches 3. Which fruit has more?", "answer": "apples", "answer_type": "text"},
    "TIME_CAL": {"question": "If today is July 6, what will be the date after 7 days?", "answer": "July 13", "answer_type": "text"},

    # ===== CLASS 4 LEVEL =====
    "NS_10000": {"question": "Write 3,456 in expanded form (thousands + hundreds + tens + ones).", "answer": "3000 + 400 + 50 + 6", "answer_type": "text"},
    "NS_FACTORS": {"question": "What are the factors of 12?", "answer": "1, 2, 3, 4, 6, 12", "answer_type": "text"},
    "NO_MULTI": {"question": "Multiply: 23 x 4 = ?", "answer": 92, "answer_type": "numeric"},
    "NO_LONGDIV": {"question": "Divide: 84 ÷ 4 = ?", "answer": 21, "answer_type": "numeric"},
    "FRAC_OPS": {"question": "Add: 1/4 + 2/4 = ?", "answer": "3/4", "answer_type": "text"},
    "DECIMALS": {"question": "Write 7/10 as a decimal.", "answer": "0.7", "answer_type": "text"},
    "MEAS_AP": {"question": "A rectangle has length 5 cm and width 3 cm. What is its area?", "answer": 15, "answer_type": "numeric"},
    "GEOM_DIR": {"question": "The sun rises in which direction?", "answer": "East", "answer_type": "text"},
    "GEOM_ANGLE": {"question": "What angle is this? (Image: 90 degree angle - right angle)", "answer": "right angle", "answer_type": "text"},
    "GEOM_SYMM": {"question": "How many lines of symmetry does a square have?", "answer": 4, "answer_type": "numeric"},

    # ===== CLASS 3 SHAPE specific =====
    "SHAPE_H": {"question": "Draw a horizontal line. Is it going left-right or up-down?", "answer": "left-right", "answer_type": "text"},
    "SHAPE_2DPROP": {"question": "How many edges does a square have?", "answer": 4, "answer_type": "numeric"},
    "SHAPE_3DPROP": {"question": "How many faces does a cube have?", "answer": 6, "answer_type": "numeric"},
    "SHAPE_TANGRAM": {"question": "How many pieces are in a tangram set?", "answer": 7, "answer_type": "numeric"},

    # ===== CLASS 3 aggregated subtopics =====
    "NS_CLASE": {"question": "Compare and classify: Which is different? A red ball, a red book, a blue pencil (color)", "answer": "blue pencil", "answer_type": "text"},
    "NS_SERE": {"question": "Arrange by length: short rope, medium rope, long rope (write 1, 2, 3)", "answer": "1, 2, 3", "answer_type": "text"},
    "NS_COUNTE": {"question": "Count: ☆☆☆☆☆☆☆☆☆☆ How many?", "answer": 10, "answer_type": "numeric"},
    "NS_NUMRE": {"question": "Circle the number 8.", "answer": 8, "answer_type": "numeric"},
    "NS_CMPNUME": {"question": "Which is less: 3 or 7?", "answer": 3, "answer_type": "numeric"},
    "NS_CLASSM": {"question": "Sort these by color: red ball, blue ball, red book. Which group has more items?", "answer": "red", "answer_type": "text"},
    "NS_SERM": {"question": "Arrange 6, 2, 8, 4 in order from smallest to largest.", "answer": "2, 4, 6, 8", "answer_type": "text"},
    "NS_COUNTM": {"question": "Count the stars: ☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆☆ How many stars? (20)", "answer": 20, "answer_type": "numeric"},
    "NS_FCM": {"question": "Count backward from 20: 20, 19, __, 17", "answer": 18, "answer_type": "numeric"},
    "NS_NWM": {"question": "Write the number ninety-nine.", "answer": 99, "answer_type": "numeric"},
    "NS_CMPM": {"question": "Which is greater: 15 or 9?", "answer": 15, "answer_type": "numeric"},
    "NS_FCH": {"question": "Count forward from 95 to 100.", "answer": "95, 96, 97, 98, 99, 100", "answer_type": "text"},
    "NS_NWH": {"question": "Write the number nine hundred ninety-nine.", "answer": 999, "answer_type": "numeric"},
    "NS_PVH": {"question": "In the number 307, what does 0 represent?", "answer": "0 tens", "answer_type": "text"},
    "NS_GSH": {"question": "Form the greatest 2-digit number using digits 4 and 7.", "answer": 74, "answer_type": "numeric"},
    "NO_EAE": {"question": "If you put 2 groups of toys together, do you have more or less?", "answer": "more", "answer_type": "text"},
    "NO_ADDM": {"question": "What is 8 + 7?", "answer": 15, "answer_type": "numeric"},
    "NO_SUBM": {"question": "What is 9 - 4?", "answer": 5, "answer_type": "numeric"},
    "NO_RELM": {"question": "If 7 + 6 = 13, then 13 - 7 = ?", "answer": 6, "answer_type": "numeric"},
    "NO_REPADDM": {"question": "5 + 5 + 5 = ?", "answer": 15, "answer_type": "numeric"},
    "NO_ADDH": {"question": "Add 45 + 38 mentally.", "answer": 83, "answer_type": "numeric"},
    "NO_SUBH": {"question": "Subtract 72 - 46 mentally.", "answer": 26, "answer_type": "numeric"},
    "NO_RELH": {"question": "A shopkeeper had 85 eggs. He sold 39. How many left?", "answer": 46, "answer_type": "numeric"},
    "NO_MULH": {"question": "There are 4 groups of 5 students. How many students in total?", "answer": 20, "answer_type": "numeric"},
    "NO_DIVH": {"question": "Divide 15 sweets among 3 children equally. Each gets ___ sweets.", "answer": 5, "answer_type": "numeric"},
    "NO_CHOOOH": {"question": "You have 24 apples and 6 baskets. Do you add, subtract, multiply or divide to find apples per basket?", "answer": "divide", "answer_type": "text"},

    # MON, MEAS, SHAPE, FRAC, PAT, DATA, CAL aggregated for Class 3
    "MON_E": {"question": "Name any Indian coin.", "answer": "Rs 5", "answer_type": "text"},
    "MON_M": {"question": "How many Rs 10 notes make Rs 50?", "answer": 5, "answer_type": "numeric"},
    "MON_H": {"question": "You have Rs 50. A toy costs Rs 35. How much money is left?", "answer": 15, "answer_type": "numeric"},
    "MEAS_M": {"question": "Estimate: How many handspans long is your desk?", "answer": 5, "answer_type": "numeric"},
    "MEAS_H": {"question": "A bag of rice weighs 5 kg. A bag of sugar weighs 2 kg. What is the total weight?", "answer": "7 kg", "answer_type": "text"},
    "SHAPE_E": {"question": "Name a shape with 3 sides.", "answer": "triangle", "answer_type": "text"},
    "SHAPE_M": {"question": "Name a 3D shape that has 6 faces, all squares.", "answer": "cube", "answer_type": "text"},
    "FRAC_E": {"question": "If you cut a sandwich into 2 equal parts, each part is called ____.", "answer": "half", "answer_type": "text"},
    "FRAC_M": {"question": "Fold a paper into 4 equal parts. Each part is called ____.", "answer": "quarter", "answer_type": "text"},
    "FRAC_H": {"question": "If a pizza has 8 slices and you eat 2, what fraction did you eat?", "answer": "2/8", "answer_type": "text"},
    "PAT_E": {"question": "Continue the pattern: ○○△○○△__", "answer": "○", "answer_type": "text"},
    "PAT_M": {"question": "What is the next number: 2, 4, 6, 8, __?", "answer": 10, "answer_type": "numeric"},
    "PAT_H": {"question": "What is the next number: 5, 10, 15, 20, __?", "answer": 25, "answer_type": "numeric"},
    "DATA_E": {"question": "In a class, 8 children have brown eyes and 4 have blue eyes. Which eye color is more common?", "answer": "brown", "answer_type": "text"},
    "DATA_M": {"question": "A survey shows 10 children like ice cream and 6 like cake. How many more like ice cream?", "answer": 4, "answer_type": "numeric"},
    "DATA_H": {"question": "Draw tally marks for the number 8.", "answer": "|||| |||", "answer_type": "text"},
    "CAL_E": {"question": "Name the day that comes after Wednesday.", "answer": "Thursday", "answer_type": "text"},
    "CAL_M": {"question": "Which month comes after March?", "answer": "April", "answer_type": "text"},
    "CAL_H": {"question": "If July 1 is a Monday, what day is July 7?", "answer": "Sunday", "answer_type": "text"},

    # ===== CLASS 4 aggregated / unique =====
    "NS_201500": {"question": "Write the number four hundred twenty-five.", "answer": 425, "answer_type": "numeric"},
    "NS_5011000": {"question": "Write the number eight hundred nine.", "answer": 809, "answer_type": "numeric"},
    "NS_H": {"question": "Write the number five thousand six hundred thirty-two.", "answer": 5632, "answer_type": "numeric"},
    "NO_E": {"question": "What is 6 + 7?", "answer": 13, "answer_type": "numeric"},
    "NO_M": {"question": "What is 12 x 3?", "answer": 36, "answer_type": "numeric"},
    "NO_H": {"question": "Add: 345 + 278", "answer": 623, "answer_type": "numeric"},
    "SHAPE_K": {"question": "How many sides does a pentagon have?", "answer": 5, "answer_type": "numeric"},
}

def load_syllabus(path):
    with open(path) as f:
        return json.load(f)

def generate_exam(syllabus, class_val, phrase):
    exam = {
        "exam_id": f"C{class_val}_WORKSHEET_{phrase.upper()}",
        "class": class_val,
        "phrase": phrase,
        "total_questions": 0,
        "questions": []
    }
    qid = 1
    topic_map = {
        "ns": "Number Sense", "no": "Number Operations", "mon": "Money",
        "meas": "Measurement", "shape": "Shapes", "frac": "Fractions",
        "pat": "Patterns", "data": "Data Handling", "cal": "Calendar and Time"
    }
    for topic in syllabus["topics"]:
        for subtopic in topic["subtopics"]:
            sid = subtopic["subtopic_id"]
            if sid in QUESTION_BANK:
                q_data = QUESTION_BANK[sid]
            else:
                q_data = {
                    "question": f"Question for {subtopic['subtopic_name']}: {subtopic['description']}",
                    "answer": "",
                    "answer_type": "text"
                }
            question = {
                "question_id": f"Q{qid}",
                "question": q_data["question"],
                "answer": q_data["answer"],
                "answer_type": q_data["answer_type"],
                "topic": topic["topic_name"],
                "subtopic": subtopic["subtopic_name"],
                "class_level": class_val,
                "difficulty": subtopic["difficulty"],
                "source_level": subtopic["source"],
                "reasoning": f"Covers subtopic: {subtopic['subtopic_name']} - {subtopic['description']}"
            }
            exam["questions"].append(question)
            qid += 1
    exam["total_questions"] = len(exam["questions"])
    return exam

def main():
    base = "/home/shreya/fln/evaluation_metrics"
    for class_num in [2, 3, 4]:
        for phrase_suffix in ["1", "2", "3"]:
            phrase = f"phrase_{phrase_suffix}"
            syllabus_path = f"{base}/syllabus/class_{class_num}/class_{class_num}_syllabus_phrase{phrase_suffix}.json"
            if not os.path.exists(syllabus_path):
                print(f"Skipping {syllabus_path} - not found")
                continue
            syllabus = load_syllabus(syllabus_path)
            exam = generate_exam(syllabus, class_num, phrase)
            out_dir = f"{base}/questions/class_{class_num}/{phrase}"
            os.makedirs(out_dir, exist_ok=True)
            out_path = f"{out_dir}/class_{class_num}_exam_{phrase}.json"
            with open(out_path, "w") as f:
                json.dump(exam, f, indent=2)
            print(f"Generated: {out_path} ({exam['total_questions']} questions)")

if __name__ == "__main__":
    main()
