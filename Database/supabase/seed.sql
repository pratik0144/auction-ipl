-- =============================================================================
-- IPL 2026 Auction Player Catalog Seed Data
-- Auto-generated from ipl_2026_auction_dataset.json by generate_seed.mjs
-- DO NOT EDIT BY HAND — re-run: node data-extraction/generate_seed.mjs
-- Total players: 100
-- =============================================================================

-- Idempotent: only seeds when the catalog is empty, so it is safe to re-run
-- and will not disturb an in-progress room.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM players) THEN
    RAISE NOTICE 'players catalog already seeded — skipping';
    RETURN;
  END IF;

  -- Royal Challengers Bengaluru (RCB) — 25 players
  INSERT INTO players (team_name, player_name, player_img_url, player_expert_in, nationality, experience_years, base_price_lakhs, base_price_display, rating)
  VALUES
  ('RCB', 'Virat Kohli', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2.png', 'Batter', 'India', 18, 2100, '₹21 Cr', 9.0),
  ('RCB', 'Rajat Patidar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/597.png', 'Batter', 'India', 5, 1100, '₹11 Cr', 8.0),
  ('RCB', 'Devdutt Padikkal', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/200.png', 'Batter', 'India', 6, 200, '₹2 Cr', 6.5),
  ('RCB', 'Phil Salt', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1220.png', 'Wicketkeeper-Batter', 'England', 5, 200, '₹2 Cr', 8.5),
  ('RCB', 'Jitesh Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1000.png', 'Wicketkeeper-Batter', 'India', 4, 200, '₹2 Cr', 7.0),
  ('RCB', 'Jordan Cox', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3372.png', 'Wicketkeeper-Batter', 'England', 3, 75, '₹75 Lakh', 5.5),
  ('RCB', 'Krunal Pandya', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/17.png', 'All-rounder', 'India', 10, 200, '₹2 Cr', 7.0),
  ('RCB', 'Venkatesh Iyer', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/584.png', 'All-rounder', 'India', 5, 200, '₹2 Cr', 7.0),
  ('RCB', 'Tim David', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/636.png', 'Batter', 'Australia', 5, 200, '₹2 Cr', 7.5),
  ('RCB', 'Romario Shepherd', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/371.png', 'All-rounder', 'West Indies', 6, 150, '₹1.5 Cr', 6.5),
  ('RCB', 'Swapnil Singh', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1483.png', 'All-rounder', 'India', 4, 30, '₹30 Lakh', 5.5),
  ('RCB', 'Jacob Bethell', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/869.png', 'All-rounder', 'England', 3, 100, '₹1 Cr', 7.0),
  ('RCB', 'Satvik Deswal', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4555.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('RCB', 'Mangesh Yadav', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4554.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 5.5),
  ('RCB', 'Vihaan Malhotra', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4012.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RCB', 'Kanishk Chouhan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4016.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RCB', 'Vicky Ostwal', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/786.png', 'All-rounder', 'India', 3, 30, '₹30 Lakh', 5.0),
  ('RCB', 'Josh Hazlewood', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/36.png', 'Pace Bowler', 'Australia', 14, 200, '₹2 Cr', 8.5),
  ('RCB', 'Bhuvneshwar Kumar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/15.png', 'Pace Bowler', 'India', 14, 200, '₹2 Cr', 7.5),
  ('RCB', 'Yash Dayal', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/978.png', 'Pace Bowler', 'India', 4, 500, '₹5 Cr', 6.5),
  ('RCB', 'Richard Gleeson', 'https://documents.iplt20.com/ipl/assets/images/Default-Men.png', 'Pace Bowler', 'England', 10, 75, '₹75 Lakh', 6.0),
  ('RCB', 'Rasikh Dar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/172.png', 'Pace Bowler', 'India', 5, 30, '₹30 Lakh', 7.0),
  ('RCB', 'Suyash Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1932.png', 'Spin Bowler', 'India', 3, 30, '₹30 Lakh', 6.0),
  ('RCB', 'Jacob Duffy', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1701.png', 'Pace Bowler', 'New Zealand', 8, 200, '₹2 Cr', 5.5),
  ('RCB', 'Abhinandan Singh', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3574.png', 'Pace Bowler', 'India', 2, 30, '₹30 Lakh', 4.5);

  -- Gujarat Titans (GT) — 25 players
  INSERT INTO players (team_name, player_name, player_img_url, player_expert_in, nationality, experience_years, base_price_lakhs, base_price_display, rating)
  VALUES
  ('GT', 'Shubman Gill', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/62.png', 'Batter', 'India', 8, 1650, '₹16.5 Cr', 9.0),
  ('GT', 'Jos Buttler', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/182.png', 'Wicketkeeper-Batter', 'England', 14, 200, '₹2 Cr', 8.5),
  ('GT', 'Kumar Kushagra', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3101.png', 'Wicketkeeper-Batter', 'India', 2, 30, '₹30 Lakh', 5.0),
  ('GT', 'Anuj Rawat', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/534.png', 'Wicketkeeper-Batter', 'India', 5, 30, '₹30 Lakh', 5.0),
  ('GT', 'Connor Esterhuizen', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/5035.png', 'Batter', 'South Africa', 2, 75, '₹75 Lakh', 5.0),
  ('GT', 'Glenn Phillips', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/635.png', 'Batter', 'New Zealand', 8, 200, '₹2 Cr', 7.0),
  ('GT', 'Sai Sudharsan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/976.png', 'Batter', 'India', 4, 850, '₹8.5 Cr', 7.5),
  ('GT', 'Nishant Sindhu', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/791.png', 'All-rounder', 'India', 3, 30, '₹30 Lakh', 5.0),
  ('GT', 'Washington Sundar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/20.png', 'All-rounder', 'India', 9, 200, '₹2 Cr', 7.5),
  ('GT', 'Mohd. Arshad Khan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/988.png', 'All-rounder', 'India', 2, 30, '₹30 Lakh', 5.0),
  ('GT', 'Sai Kishore', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/544.png', 'Spin Bowler', 'India', 5, 75, '₹75 Lakh', 6.5),
  ('GT', 'Jayant Yadav', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/165.png', 'All-rounder', 'India', 10, 75, '₹75 Lakh', 5.5),
  ('GT', 'Jason Holder', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/263.png', 'All-rounder', 'West Indies', 12, 200, '₹2 Cr', 7.5),
  ('GT', 'Rahul Tewatia', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/120.png', 'All-rounder', 'India', 9, 400, '₹4 Cr', 7.0),
  ('GT', 'Shahrukh Khan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/590.png', 'All-rounder', 'India', 5, 400, '₹4 Cr', 6.5),
  ('GT', 'Kagiso Rabada', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/116.png', 'Pace Bowler', 'South Africa', 11, 200, '₹2 Cr', 9.0),
  ('GT', 'Mohammed Siraj', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/63.png', 'Pace Bowler', 'India', 9, 200, '₹2 Cr', 7.5),
  ('GT', 'Prasidh Krishna', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/150.png', 'Pace Bowler', 'India', 7, 200, '₹2 Cr', 7.0),
  ('GT', 'Manav Suthar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2443.png', 'Spin Bowler', 'India', 2, 30, '₹30 Lakh', 5.5),
  ('GT', 'Gurnoor Singh Brar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1231.png', 'Pace Bowler', 'India', 3, 30, '₹30 Lakh', 5.5),
  ('GT', 'Ishant Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/50.png', 'Pace Bowler', 'India', 18, 75, '₹75 Lakh', 5.0),
  ('GT', 'Ashok Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/980.png', 'Pace Bowler', 'India', 2, 30, '₹30 Lakh', 5.0),
  ('GT', 'Luke Wood', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3116.png', 'Pace Bowler', 'England', 6, 75, '₹75 Lakh', 5.5),
  ('GT', 'Kulwant Khejroliya', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/204.png', 'Pace Bowler', 'India', 8, 30, '₹30 Lakh', 5.5),
  ('GT', 'Rashid Khan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/218.png', 'Spin Bowler', 'Afghanistan', 10, 1800, '₹18 Cr', 9.0);

  -- Sunrisers Hyderabad (SRH) — 25 players
  INSERT INTO players (team_name, player_name, player_img_url, player_expert_in, nationality, experience_years, base_price_lakhs, base_price_display, rating)
  VALUES
  ('SRH', 'Ishan Kishan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/164.png', 'Wicketkeeper-Batter', 'India', 8, 200, '₹2 Cr', 7.5),
  ('SRH', 'Aniket Verma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3576.png', 'Batter', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Smaran Ravichandran', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3752.png', 'Batter', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Salil Arora', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4556.png', 'Batter', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Heinrich Klaasen', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/202.png', 'Wicketkeeper-Batter', 'South Africa', 8, 2300, '₹23 Cr', 9.0),
  ('SRH', 'Travis Head', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/37.png', 'Batter', 'Australia', 10, 1400, '₹14 Cr', 8.5),
  ('SRH', 'Harshal Patel', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/114.png', 'Pace Bowler', 'India', 12, 200, '₹2 Cr', 7.5),
  ('SRH', 'Kamindu Mendis', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/627.png', 'All-rounder', 'Sri Lanka', 5, 75, '₹75 Lakh', 7.0),
  ('SRH', 'Harsh Dubey', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1494.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Shivang Kumar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4561.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('SRH', 'Krains Fuletra', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4557.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('SRH', 'Liam Livingstone', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/183.png', 'All-rounder', 'England', 8, 200, '₹2 Cr', 8.0),
  ('SRH', 'Abhishek Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/212.png', 'All-rounder', 'India', 5, 1400, '₹14 Cr', 8.0),
  ('SRH', 'Nitish Kumar Reddy', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1944.png', 'All-rounder', 'India', 3, 600, '₹6 Cr', 7.5),
  ('SRH', 'Pat Cummins', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/33.png', 'Pace Bowler', 'Australia', 15, 1800, '₹18 Cr', 9.0),
  ('SRH', 'Zeeshan Ansari', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3575.png', 'Spin Bowler', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Jaydev Unadkat', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/180.png', 'Pace Bowler', 'India', 14, 100, '₹1 Cr', 5.5),
  ('SRH', 'Eshan Malinga', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3339.png', 'Pace Bowler', 'India', 2, 30, '₹30 Lakh', 5.0),
  ('SRH', 'Sakib Hussain', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3104.png', 'Pace Bowler', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Onkar Tarmale', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4560.png', 'Pace Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('SRH', 'Amit Kumar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4559.png', 'Pace Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('SRH', 'Praful Hinge', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4558.png', 'Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('SRH', 'Dilshan Madushanka', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1018.png', 'Pace Bowler', 'Sri Lanka', 3, 75, '₹75 Lakh', 6.0),
  ('SRH', 'Gerald Coetzee', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2535.png', 'Pace Bowler', 'South Africa', 4, 125, '₹1.25 Cr', 7.0),
  ('SRH', 'R.S. Ambrish', 'https://documents.iplt20.com/ipl/assets/images/Default-Men.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.0);

  -- Rajasthan Royals (RR) — 25 players
  INSERT INTO players (team_name, player_name, player_img_url, player_expert_in, nationality, experience_years, base_price_lakhs, base_price_display, rating)
  VALUES
  ('RR', 'Yashasvi Jaiswal', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/533.png', 'Batter', 'India', 6, 1800, '₹18 Cr', 9.0),
  ('RR', 'Dhruv Jurel', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1004.png', 'Wicketkeeper-Batter', 'India', 3, 1400, '₹14 Cr', 7.5),
  ('RR', 'Shimron Hetmyer', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/210.png', 'Batter', 'West Indies', 9, 1100, '₹11 Cr', 7.5),
  ('RR', 'Shubham Dubey', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3112.png', 'Batter', 'India', 3, 580, '₹5.8 Cr', 5.5),
  ('RR', 'Vaibhav Sooryavanshi', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3498.png', 'Batter', 'India', 2, 30, '₹30 Lakh', 6.5),
  ('RR', 'Lhuan-dre Pretorious', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2827.png', 'Wicketkeeper-Batter', 'South Africa', 2, 30, '₹30 Lakh', 5.5),
  ('RR', 'Aman Rao Perala', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4552.png', 'Batter', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RR', 'Riyan Parag', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/189.png', 'All-rounder', 'India', 7, 1400, '₹14 Cr', 8.0),
  ('RR', 'Ravindra Jadeja', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/46.png', 'All-rounder', 'India', 17, 1400, '₹14 Cr', 8.5),
  ('RR', 'Dasun Shanaka', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/375.png', 'All-rounder', 'Sri Lanka', 10, 75, '₹75 Lakh', 7.0),
  ('RR', 'Donovan Ferreira', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2033.png', 'Wicketkeeper-Batter', 'South Africa', 3, 75, '₹75 Lakh', 5.5),
  ('RR', 'Yudhvir Singh Charak', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/587.png', 'All-rounder', 'India', 2, 30, '₹30 Lakh', 4.5),
  ('RR', 'Ravi Bishnoi', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/520.png', 'Spin Bowler', 'India', 6, 200, '₹2 Cr', 7.5),
  ('RR', 'Jofra Archer', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/181.png', 'Pace Bowler', 'England', 8, 200, '₹2 Cr', 8.5),
  ('RR', 'Tushar Deshpande', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/539.png', 'Pace Bowler', 'India', 6, 100, '₹1 Cr', 6.5),
  ('RR', 'Kwena Maphaka', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/801.png', 'Pace Bowler', 'South Africa', 2, 75, '₹75 Lakh', 6.5),
  ('RR', 'Nandre Burger', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2806.png', 'Pace Bowler', 'South Africa', 4, 75, '₹75 Lakh', 6.5),
  ('RR', 'Sandeep Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/220.png', 'Pace Bowler', 'India', 12, 400, '₹4 Cr', 6.0),
  ('RR', 'Kuldeep Sen', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1005.png', 'Pace Bowler', 'India', 4, 50, '₹50 Lakh', 5.5),
  ('RR', 'Adam Milne', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/157.png', 'Pace Bowler', 'New Zealand', 12, 150, '₹1.5 Cr', 6.0),
  ('RR', 'Sushant Mishra', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1016.png', 'Pace Bowler', 'India', 2, 50, '₹50 Lakh', 5.0),
  ('RR', 'Yash Raj Punja', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4553.png', 'Spin Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RR', 'Brijesh Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4551.png', 'Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RR', 'Vignesh Puthur', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3566.png', 'Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RR', 'Emanjot Chahal', 'https://documents.iplt20.com/ipl/assets/images/Default-Men.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.5);
END $$;
