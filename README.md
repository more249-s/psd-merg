# 🎨 Manga PSD Merger (Native Edition)

<p align="center">
  <img src="app_icon.png" alt="Manga PSD Merger Logo" width="128" height="128">
  <br>
  <b>أداة مكتبية فائقة السرعة لدمج طبقات المانجا والمانهوا المصنوعة من الصور الخام (RAW) والصور النظيفة (CLEAN) في ملفات PSD بضغطة زر واحدة.</b>
  <br>
  <i>A lightning-fast, native desktop tool to merge RAW and CLEAN manga/manhwa image layers into multi-layer Photoshop (PSD) files.</i>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.11">
  <img src="https://img.shields.io/badge/UI-CustomTkinter-blue?style=for-the-badge" alt="CustomTkinter">
  <img src="https://img.shields.io/badge/Engine-Native_C++-00599C?style=for-the-badge&logo=cplusplus&logoColor=white" alt="C++ Core">
  <img src="https://img.shields.io/badge/Platform-Windows_10%2F11-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows">
  <img src="https://img.shields.io/badge/Portable-Standalone_EXE-10B981?style=for-the-badge" alt="Portable EXE">
</p>

---

## 🌟 المميزات الرئيسية (Features)

* **🚀 أداء فائق السرعة:** تعتمد الأداة في الخلفية على محرك كود مكتوب بلغة C++ عالية الأداء لمعالجة الصور وإنشاء ملفات الـ PSD في ثوانٍ معدودة.
* **💻 واجهة مكتبية خفيفة وعصرية:** مبنية باستخدام مكتبة **CustomTkinter** بمظهر داكن راقٍ (Dark Slate Mode)، خفيفة جداً على الذاكرة (أقل من 30MB) وبدون متصفحات أو ويب.
* **📦 تطبيق مستقل ومحمول (100% Standalone EXE):** برنامج تنفيذي واحد لا يتطلب تثبيت بايثون، نود، أو أي مكتبات برمجية على جهاز المستخدم.
* **📋 نظام لصق وتنظيف ذكي (Smart Paste & Quote Stripping):** 
  * زر **Paste** للصق المسار فوراً من الحافظة.
  * إزالة تلقائية لعلامات الاقتباس عند نسخ المسار عبر خيار Windows `"Copy as path"`.
  * زر **Clear** لمسح المسارات القديمة بسرعة.
  * قائمة كليك يمين أصلية (Cut, Copy, Paste).
* **📊 شريط تقدم عصري (Dashboard Card Progress Bar):** متابعة لحظية لنسبة دمج الفصول مع إشعارات منبثقة رسمية عند النجاح أو حدوث أخطاء.
* **🔄 فك قفل ديناميكي (Auto-Unlock):** بمجرد تغيير المسار يتم إعادة تهيئة الواجهة فوراُ للبدء في دمج فصل جديد دون الحاجة لإعادة تشغيل التطبيق.

---

## 📥 التحميل والاستخدام المباشر (Direct Download)

لا تحتاج إلى تثبيت أي برامج أو لغات برمجة!

1. اذهب إلى صفحة **[Releases](../../releases/latest)** في هذا المستودع.
2. قم بتحميل ملف **`manga-psd-merger-gui.exe`**.
3. شغيل الملف مباشرة بنقرة مزدوجة!

> 💡 **ملاحظة للمستخدمين لأول مرة:** عند تشغيل الملف، قد يظهر تنبيه من **Windows SmartScreen** لأن التطبيق غير موقع إلكترونياً بشهادة مدفوعة الثمن. اضغط على **More info (المزيد من المعلومات)** ثم **Run anyway (التشغيل على أي حال)** ليعمل التطبيق مباشرة.

---

## 📖 كيفية الاستخدام (Usage Guide)

1. **مسار الفصل (Chapter Folder Path):** 
   * اضغط على **Browse** لاختيار المجلد يدوياً، أو **Paste** للصق المسار من الكليبورد.
2. **المجلد الفرعي للصور النظيفة (Clean Subfolder):**
   * ستقوم الأداة تلقائياً بفحص المجلد وتعبئة الخيارات المتاحة (مثل `[Cleaned]` أو `JPEG`).
3. **إعدادات الطبقات (Execution Settings):**
   * اختر اسم طبقة RAW السفلى، واسم طبقة CLEAN العليا، واسم المجلد المخرج (`Output_PSDs`).
4. **بدء الدمج:**
   * اضغط على **Start PSD Merge** واستمتع بالسرعة!

---

## 🛠️ البناء من المصدر (Build from Source)

إذا كنت مطوراً وترغب في بناء التطبيق بنفسك:

```bash
# 1. استنساخ المستودع
git clone https://github.com/your-username/manga-psd-merger.git
cd manga-psd-merger

# 2. تثبيت المكتبات المطلوبة
pip install customtkinter pyinstaller pillow

# 3. تشغيل كود البناء المباشر
python compile.py
```

سيتم بناء الملف التنفيذي النهائي الموحد في المجلد الرئيسي باسم `manga-psd-merger-gui.exe`.

---

## 📜 الترخيص (License)

هذا المشروع متاح مجاناً ومفتوح المصدر للاستخدام الشخصي والتطوير تحت ترخيص **MIT License**.
