#!/bin/bash
# IPL 2026 Dataset Builder
# Downloads all player headshots and generates the JSON dataset

BASE_DIR="/Users/pratikpotadar/Desktop/auction11/data-extraction"
IMG_BASE="$BASE_DIR/images"
JSON_FILE="$BASE_DIR/ipl_2026_auction_dataset.json"
HEADSHOT_URL="https://documents.iplt20.com/ipl/IPLHeadshot2026"

mkdir -p "$IMG_BASE/RCB" "$IMG_BASE/GT" "$IMG_BASE/SRH" "$IMG_BASE/RR"

echo "Downloading all player headshots..."

# Function to download image
download_img() {
  local team="$1"
  local name="$2"
  local hid="$3"
  local filename=$(echo "$name" | tr ' ' '_' | tr -cd '[:alnum:]_').png
  local path="$IMG_BASE/$team/$filename"
  if [ ! -f "$path" ]; then
    if [ "$hid" = "default" ]; then
      curl -sL "https://documents.iplt20.com/ipl/assets/images/Default-Men.png" -o "$path" 2>/dev/null
    else
      curl -sL "$HEADSHOT_URL/$hid.png" -o "$path" 2>/dev/null
    fi
    if [ $? -eq 0 ] && [ -s "$path" ]; then
      echo "  ✓ $team/$name ($hid)"
    else
      echo "  ✗ $team/$name ($hid) - failed, retrying..."
      if [ "$hid" = "default" ]; then
        curl -sL "https://documents.iplt20.com/ipl/assets/images/Default-Men.png" -o "$path" 2>/dev/null
      else
        curl -sL "$HEADSHOT_URL/$hid.png" -o "$path" 2>/dev/null
      fi
    fi
  else
    echo "  - $team/$name (exists)"
  fi
}

# ===== RCB =====
echo "--- RCB ---"
download_img "RCB" "Virat Kohli" 2
download_img "RCB" "Rajat Patidar" 597
download_img "RCB" "Devdutt Padikkal" 200
download_img "RCB" "Phil Salt" 1220
download_img "RCB" "Jitesh Sharma" 1000
download_img "RCB" "Jordan Cox" 3372
download_img "RCB" "Krunal Pandya" 17
download_img "RCB" "Venkatesh Iyer" 584
download_img "RCB" "Tim David" 636
download_img "RCB" "Romario Shepherd" 371
download_img "RCB" "Swapnil Singh" 1483
download_img "RCB" "Jacob Bethell" 869
download_img "RCB" "Satvik Deswal" 4555
download_img "RCB" "Mangesh Yadav" 4554
download_img "RCB" "Vihaan Malhotra" 4012
download_img "RCB" "Kanishk Chouhan" 4016
download_img "RCB" "Vicky Ostwal" 786
download_img "RCB" "Josh Hazlewood" 36
download_img "RCB" "Bhuvneshwar Kumar" 15
download_img "RCB" "Yash Dayal" 978
download_img "RCB" "Richard Gleeson" "default"
download_img "RCB" "Rasikh Dar" 172
download_img "RCB" "Suyash Sharma" 1932
download_img "RCB" "Jacob Duffy" 1701
download_img "RCB" "Abhinandan Singh" 3574

# ===== GT =====
echo "--- GT ---"
download_img "GT" "Shubman Gill" 62
download_img "GT" "Jos Buttler" 182
download_img "GT" "Kumar Kushagra" 3101
download_img "GT" "Anuj Rawat" 534
download_img "GT" "Connor Esterhuizen" 5035
download_img "GT" "Glenn Phillips" 635
download_img "GT" "Sai Sudharsan" 976
download_img "GT" "Nishant Sindhu" 791
download_img "GT" "Washington Sundar" 20
download_img "GT" "Mohd. Arshad Khan" 988
download_img "GT" "Sai Kishore" 544
download_img "GT" "Jayant Yadav" 165
download_img "GT" "Jason Holder" 263
download_img "GT" "Rahul Tewatia" 120
download_img "GT" "Shahrukh Khan" 590
download_img "GT" "Kagiso Rabada" 116
download_img "GT" "Mohammed Siraj" 63
download_img "GT" "Prasidh Krishna" 150
download_img "GT" "Manav Suthar" 2443
download_img "GT" "Gurnoor Singh Brar" 1231
download_img "GT" "Ishant Sharma" 50
download_img "GT" "Ashok Sharma" 980
download_img "GT" "Luke Wood" 3116
download_img "GT" "Kulwant Khejroliya" 204
download_img "GT" "Rashid Khan" 218

# ===== SRH =====
echo "--- SRH ---"
download_img "SRH" "Ishan Kishan" 164
download_img "SRH" "Aniket Verma" 3576
download_img "SRH" "Smaran Ravichandran" 3752
download_img "SRH" "Salil Arora" 4556
download_img "SRH" "Heinrich Klaasen" 202
download_img "SRH" "Travis Head" 37
download_img "SRH" "Harshal Patel" 114
download_img "SRH" "Kamindu Mendis" 627
download_img "SRH" "Harsh Dubey" 1494
download_img "SRH" "Shivang Kumar" 4561
download_img "SRH" "Krains Fuletra" 4557
download_img "SRH" "Liam Livingstone" 183
download_img "SRH" "Abhishek Sharma" 212
download_img "SRH" "Nitish Kumar Reddy" 1944
download_img "SRH" "Pat Cummins" 33
download_img "SRH" "Zeeshan Ansari" 3575
download_img "SRH" "Jaydev Unadkat" 180
download_img "SRH" "Eshan Malinga" 3339
download_img "SRH" "Sakib Hussain" 3104
download_img "SRH" "Onkar Tarmale" 4560
download_img "SRH" "Amit Kumar" 4559
download_img "SRH" "Praful Hinge" 4558
download_img "SRH" "Dilshan Madushanka" 1018
download_img "SRH" "Gerald Coetzee" 2535
download_img "SRH" "R.S. Ambrish" "default"

# ===== RR =====
echo "--- RR ---"
download_img "RR" "Yashasvi Jaiswal" 533
download_img "RR" "Dhruv Jurel" 1004
download_img "RR" "Shimron Hetmyer" 210
download_img "RR" "Shubham Dubey" 3112
download_img "RR" "Vaibhav Sooryavanshi" 3498
download_img "RR" "Lhuan-dre Pretorious" 2827
download_img "RR" "Aman Rao Perala" 4552
download_img "RR" "Riyan Parag" 189
download_img "RR" "Ravindra Jadeja" 46
download_img "RR" "Dasun Shanaka" 375
download_img "RR" "Donovan Ferreira" 2033
download_img "RR" "Yudhvir Singh Charak" 587
download_img "RR" "Ravi Bishnoi" 520
download_img "RR" "Jofra Archer" 181
download_img "RR" "Tushar Deshpande" 539
download_img "RR" "Kwena Maphaka" 801
download_img "RR" "Nandre Burger" 2806
download_img "RR" "Sandeep Sharma" 220
download_img "RR" "Kuldeep Sen" 1005
download_img "RR" "Adam Milne" 157
download_img "RR" "Sushant Mishra" 1016
download_img "RR" "Yash Raj Punja" 4553
download_img "RR" "Brijesh Sharma" 4551
download_img "RR" "Vignesh Puthur" 3566
download_img "RR" "Emanjot Chahal" "default"

echo ""
echo "Image download complete!"
echo "Total images:"
find "$IMG_BASE" -name "*.png" | wc -l
echo ""

# Verify all images exist
echo "Verification:"
for team in RCB GT SRH RR; do
  count=$(find "$IMG_BASE/$team" -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
  echo "  $team: $count images"
done
