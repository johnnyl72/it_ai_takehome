Label Check test kit

23 fake label images and an applications.csv with 23 rows. Each label
tests one rule. answer-key.csv says what each one should get and why.

To check them all at once:
1. Open https://itaitakehome.vercel.app/batch
2. Drag the labels folder onto "Add the label images".
3. Drag applications.csv onto "Add the application details".
4. Before checking, the tool should report:
   - 23 images, 22 matched to an application (1 by name, ignoring a different
     file extension), 1 with no application row, 1 exact copy of another.
   - 23 applications, 22 matched to an image, 1 with no image.
5. Press "Check 23 labels". When it finishes it should show:
   10 with problems, 4 to review, 8 matching, 1 couldn't be checked,
   1 missing an image.
6. Press "Show details" on any row to see why. Compare with answer-key.csv.

To check one label, open https://itaitakehome.vercel.app, add the image,
and type in its row from applications.csv.

All brands, companies and addresses are made up.
