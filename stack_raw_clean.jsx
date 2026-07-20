// #target photoshop
app.bringToFront();
app.displayDialogs = DialogModes.NO;

// ===== إعدادات بسيطة =====
var RAW_EXTS   = [".png", ".jpg", ".jpeg", ".psd", ".tif", ".tiff", ".webp"];
var CLEAN_EXTS = [".png", ".jpg", ".jpeg", ".psd", ".tif", ".tiff", ".webp"];

// هل الملف صورة؟
function hasExt(name, exts) {
    var n = String(name || "").toLowerCase();
    for (var i = 0; i < exts.length; i++) {
        var ext = exts[i]; // ex: ".jpg"
        if (n.length >= ext.length &&
            n.substr(n.length - ext.length) === ext) {
            return true;
        }
    }
    return false;
}

// إزالة الامتداد
function stripExt(name) {
    var idx = name.lastIndexOf(".");
    if (idx < 0) return name;
    return name.substring(0, idx);
}

// البحث عن ملف الكلين المطابق
function findCleanForRaw(rawFile, cleanFolder) {
    // مثال: rawFile.name = "01.jpg" → base = "01"
    var base = stripExt(rawFile.name);
    var baseLower = base.toLowerCase();
    var i, ext, cand;

    // 1) نجرب base_clean.ext (قديم)
    for (i = 0; i < CLEAN_EXTS.length; i++) {
        ext = CLEAN_EXTS[i];
        cand = new File(cleanFolder.fsName + "/" + base + "_clean" + ext);
        if (cand.exists) return cand;
    }

    // 2) نجرب base.ext جوه clean (الحالة الجديدة: 01.jpg في root و clean/01.jpg)
    for (i = 0; i < CLEAN_EXTS.length; i++) {
        ext = CLEAN_EXTS[i];
        cand = new File(cleanFolder.fsName + "/" + base + ext);
        if (cand.exists) return cand;
    }

    // 3) ماتش مرن شوية:
    //    أي ملف جوه clean/ يبدأ بـ base ويتبعه _ أو - أو space أو (…)
    //    زي: "01 clean.png", "01-clean.png", "01 (clean).png", "01.cleaned.png" إلخ.
    var files = cleanFolder.getFiles();
    for (i = 0; i < files.length; i++) {
        var f = files[i];
        if (!(f instanceof File)) continue;
        if (!hasExt(f.name, CLEAN_EXTS)) continue;

        var stem = stripExt(f.name).toLowerCase();

        if (
            stem === baseLower ||                          // 01
            stem === baseLower + "_clean" ||               // 01_clean
            stem === baseLower + "-clean" ||               // 01-clean
            stem === baseLower + " clean" ||               // 01 clean
            stem === baseLower + " (clean)" ||             // 01 (clean)
            stem.indexOf(baseLower + "_") === 0 ||         // 01_xxx...
            stem.indexOf(baseLower + "-") === 0 ||         // 01-xxx...
            stem.indexOf(baseLower + " ") === 0 ||         // 01 xxx...
            stem.indexOf(baseLower + ".") === 0            // 01.cleaned ...
        ) {
            return f;
        }
    }

    // لو ملقيناش أي حاجة
    return null;
}

// حفظ كـ PSD في فولدر مخصص
function saveAsPSD(doc, psdFolder, baseName) {
    var psdFile = new File(psdFolder.fsName + "/" + baseName + ".psd");
    var opts = new PhotoshopSaveOptions();
    opts.embedColorProfile = true;
    opts.alphaChannels = true;
    doc.saveAs(psdFile, opts, true, Extension.LOWERCASE);
}

// ===== السكربت الرئيسي =====
(function () {
    // 1) نجيب فولدر السكربت نفسه
    var scriptFile = new File($.fileName);
    var baseFolder = scriptFile.parent;

    if (!baseFolder || !baseFolder.exists) {
        alert("لم أستطع تحديد فولدر السكربت.");
        return;
    }

    // 2) فولدر الكلين (clean/)
    var cleanFolder = new Folder(baseFolder.fsName + "/clean");
    if (!cleanFolder.exists) {
        alert(
            "لم أجد فولدر 'clean' بجوار السكربت.\n" +
            "الهيكل المتوقع:\n" +
            "  - نفس الفولدر: الراو (01.jpg, 02.jpg, ...)\n" +
            "  - clean/ : الصور المبيّضة (01.jpg أو 01_clean.png, ...)"
        );
        return;
    }

    // 3) فولدر psd/ الذي سنحفظ فيه النتائج
    var psdFolder = new Folder(baseFolder.fsName + "/psd");
    if (!psdFolder.exists) psdFolder.create();

    // 4) نجمع ملفات الراو من الجذر (نستثني *_clean و *_mask و ملفات غير الصور)
    var allFiles = baseFolder.getFiles();
    var rawFiles = [];
    for (var i = 0; i < allFiles.length; i++) {
        var f = allFiles[i];
        if (!(f instanceof File)) continue;
        if (f.name === scriptFile.name) continue; // تجاهل السكربت نفسه
        var lower = f.name.toLowerCase();
        if (!hasExt(lower, RAW_EXTS)) continue;
        if (lower.indexOf("_clean") !== -1) continue;
        if (lower.indexOf("_mask")  !== -1) continue;
        rawFiles.push(f);
    }

    if (rawFiles.length === 0) {
        alert(
            "لم أجد أي صور RAW في نفس فولدر السكربت.\n" +
            "تأكد أن صور الراو في نفس المكان، والكلين في فولدر clean/."
        );
        return;
    }

    // 5) نلف على كل ملف RAW
    var processed = 0;
    var skipped   = 0;

    for (var r = 0; r < rawFiles.length; r++) {
        var rawFile = rawFiles[r];
        var baseName = stripExt(rawFile.name);

        // نبحث عن الكلين
        var cleanFile = findCleanForRaw(rawFile, cleanFolder);
        if (!cleanFile) {
            // مفيش مطابق → نتجاهله
            skipped++;
            continue;
        }

        try {
            // نفتح الراو
            var docRaw = app.open(rawFile);

            // نفتح الكلين في تبويب منفصل
            var docClean = app.open(cleanFile);

            // لو الأحجام مختلفة، نكبر/نصغّر الكلين لمقاس الراو
            if (docClean.width != docRaw.width || docClean.height != docRaw.height) {
                docClean.resizeImage(
                    docRaw.width,
                    docRaw.height,
                    docRaw.resolution,
                    ResampleMethod.BICUBIC
                );
            }

            // ننسخ كل ليرات الكلين كـ Layer واحد فوق الراو
            app.activeDocument = docClean;
            docClean.selection.selectAll();
            docClean.selection.copy();
            docClean.close(SaveOptions.DONOTSAVECHANGES);

            app.activeDocument = docRaw;
            var cleanLayer = docRaw.paste();
            cleanLayer.name = "CLEAN";

            // نسمي لير الخلفية إن لزم
            try {
                docRaw.backgroundLayer.name = "RAW";
            } catch (e) {
                // لو مفيش backgroundLayer (مثلاً ملف شفاف)، نتجاهل
            }

            // نحفظ كـ PSD في فولدر psd/ باسم الصفحة
            saveAsPSD(docRaw, psdFolder, baseName);

            // نقفل بدون حفظ الـ RAW المعدّل (لأننا حفظنا الـ PSD)
            docRaw.close(SaveOptions.DONOTSAVECHANGES);

            processed++;
        } catch (err) {
            // لو حصل أي مشكلة في صفحة واحدة، نكمل على الباقي
            skipped++;
        }
    }

    alert(
        "انتهى السكربت.\n\n" +
        "تم إنشاء PSD لعدد: " + processed + " صفحة.\n" +
        "تم تخطي: " + skipped + " (بدون ملف CLEAN مطابق أو حدث خطأ)." +
        "\n\nالملفات محفوظة في فولدر:\n" + psdFolder.fsName
    );
})();
