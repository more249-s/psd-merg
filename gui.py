import sys
import os

if getattr(sys, 'frozen', False):
    os.chdir(sys._MEIPASS)

import subprocess
import threading
import customtkinter as ctk
from tkinter import filedialog, messagebox

# Set clean, professional styling
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

class MangaMergerApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("Manga PSD Merger")
        self.geometry("450x630")
        self.minsize(420, 600)
        
        # Configure grid layout
        self.grid_rowconfigure(0, weight=0) # Header
        self.grid_rowconfigure(1, weight=1) # Main content
        self.grid_columnconfigure(0, weight=1)
        
        # State variables
        self.clean_folders_list = []
        self.merging_in_progress = False
        
        # Resolve target executable path
        if getattr(sys, 'frozen', False):
            # Check inside PyInstaller temp folder first (bundled mode)
            if os.path.exists(os.path.join(sys._MEIPASS, "manga-psd-merger.exe")):
                self.exe_dir = sys._MEIPASS
            else:
                self.exe_dir = os.path.dirname(sys.executable)
        else:
            self.exe_dir = os.path.dirname(os.path.abspath(__file__))
        self.merger_exe_path = os.path.join(self.exe_dir, "manga-psd-merger.exe")
        
        # Load window titlebar icon
        if getattr(sys, 'frozen', False):
            ico_path = os.path.join(sys._MEIPASS, "app_icon.ico")
        else:
            ico_path = os.path.join(self.exe_dir, "app_icon.ico")
            
        if os.path.exists(ico_path):
            try:
                self.iconbitmap(ico_path)
            except Exception:
                pass
        
        self.setup_header()
        self.setup_main_layout()
        
        # Print initial diagnosis
        self.check_merger_exe()

    def setup_header(self):
        header_frame = ctk.CTkFrame(self, height=60, corner_radius=0, fg_color="#18181b")
        header_frame.grid(row=0, column=0, sticky="ew")
        header_frame.grid_propagate(False)
        
        title_label = ctk.CTkLabel(
            header_frame, 
            text="MANGA PSD MERGER", 
            font=ctk.CTkFont(family="Segoe UI", size=16, weight="bold"),
            text_color="#f4f4f5"
        )
        title_label.pack(side="left", padx=20, pady=15)
        
        status_badge = ctk.CTkLabel(
            header_frame,
            text="NATIVE",
            font=ctk.CTkFont(family="Segoe UI", size=10, weight="bold"),
            text_color="#a1a1aa",
            fg_color="#27272a",
            corner_radius=4,
            width=70,
            height=20
        )
        status_badge.pack(side="right", padx=20, pady=20)

    def setup_main_layout(self):
        # Single column layout container
        content_frame = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        content_frame.grid(row=1, column=0, sticky="nsew", padx=15, pady=15)
        
        content_frame.grid_columnconfigure(0, weight=1)
        content_frame.grid_rowconfigure(0, weight=1)
        
        # Main form panel
        form_frame = ctk.CTkFrame(content_frame, corner_radius=8, border_width=1, border_color="#27272a", fg_color="#18181b")
        form_frame.grid(row=0, column=0, sticky="nsew", padx=0)
        
        # Chapter folder input
        lbl_path = ctk.CTkLabel(form_frame, text="Chapter Folder Path:", font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"))
        lbl_path.pack(anchor="w", padx=15, pady=(15, 5))
        
        path_input_frame = ctk.CTkFrame(form_frame, fg_color="transparent")
        path_input_frame.pack(fill="x", padx=15, pady=0)
        
        self.path_var = ctk.StringVar()
        self.path_var.trace_add("write", self.on_path_var_changed)
        
        self.entry_path = ctk.CTkEntry(
            path_input_frame, 
            placeholder_text="Select chapter folder...",
            font=ctk.CTkFont(size=11),
            height=32,
            fg_color="#09090b",
            border_color="#27272a",
            textvariable=self.path_var
        )
        self.entry_path.pack(side="left", fill="x", expand=True, padx=(0, 6))
        self.entry_path.bind("<Button-3>", self.show_context_menu)
        self.entry_path.bind("<<Paste>>", lambda e: self.paste_text() or "break")
        
        btn_browse = ctk.CTkButton(
            path_input_frame, 
            text="Browse", 
            width=65,
            height=32,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=self.browse_folder,
            fg_color="#27272a",
            hover_color="#3f3f46"
        )
        btn_browse.pack(side="right")
        
        btn_paste = ctk.CTkButton(
            path_input_frame, 
            text="Paste", 
            width=55,
            height=32,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=self.paste_text,
            fg_color="#27272a",
            hover_color="#3f3f46"
        )
        btn_paste.pack(side="right", padx=(0, 6))
        
        btn_clear = ctk.CTkButton(
            path_input_frame, 
            text="Clear", 
            width=55,
            height=32,
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            command=lambda: self.path_var.set(""),
            fg_color="#27272a",
            hover_color="#3f3f46"
        )
        btn_clear.pack(side="right", padx=(0, 6))
        
        # Clean folder dropdown
        lbl_clean = ctk.CTkLabel(form_frame, text="Clean Images Subfolder:", font=ctk.CTkFont(family="Segoe UI", size=12, weight="bold"))
        lbl_clean.pack(anchor="w", padx=15, pady=(15, 5))
        
        self.combo_clean = ctk.CTkComboBox(
            form_frame, 
            values=["(No folders found)"],
            height=32,
            state="readonly",
            fg_color="#09090b",
            border_color="#27272a"
        )
        self.combo_clean.pack(fill="x", padx=15, pady=0)
        
        # Separator line
        sep = ctk.CTkFrame(form_frame, height=1, fg_color="#27272a")
        sep.pack(fill="x", padx=15, pady=15)
        
        # Settings Header
        lbl_sett = ctk.CTkLabel(form_frame, text="Execution Settings", font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"))
        lbl_sett.pack(anchor="w", padx=15, pady=(0, 5))
        
        # Custom layer name RAW
        lbl_raw_layer = ctk.CTkLabel(form_frame, text="Bottom Layer (RAW) Name:", font=ctk.CTkFont(size=11))
        lbl_raw_layer.pack(anchor="w", padx=15, pady=(5, 2))
        self.entry_raw_layer = ctk.CTkEntry(form_frame, height=28, fg_color="#09090b", border_color="#27272a")
        self.entry_raw_layer.insert(0, "RAW")
        self.entry_raw_layer.pack(fill="x", padx=15, pady=0)
        
        # Custom layer name CLEAN
        lbl_clean_layer = ctk.CTkLabel(form_frame, text="Top Layer (CLEAN) Name:", font=ctk.CTkFont(size=11))
        lbl_clean_layer.pack(anchor="w", padx=15, pady=(8, 2))
        self.entry_clean_layer = ctk.CTkEntry(form_frame, height=28, fg_color="#09090b", border_color="#27272a")
        self.entry_clean_layer.insert(0, "CLEAN")
        self.entry_clean_layer.pack(fill="x", padx=15, pady=0)
        
        # Output folder option
        lbl_output = ctk.CTkLabel(form_frame, text="PSD Output Folder Name:", font=ctk.CTkFont(size=11))
        lbl_output.pack(anchor="w", padx=15, pady=(8, 2))
        self.entry_output = ctk.CTkEntry(form_frame, height=28, fg_color="#09090b", border_color="#27272a")
        self.entry_output.insert(0, "Output_PSDs")
        self.entry_output.pack(fill="x", padx=15, pady=0)
        
        # Action merge button
        self.btn_merge = ctk.CTkButton(
            form_frame, 
            text="Start PSD Merge",
            height=42,
            font=ctk.CTkFont(family="Segoe UI", size=13, weight="bold"),
            command=self.start_merge,
            fg_color="#2563eb",
            hover_color="#1d4ed8"
        )
        self.btn_merge.pack(fill="x", padx=15, pady=(20, 10))
        
        # Progress indicator panel (Card Style)
        progress_card = ctk.CTkFrame(form_frame, fg_color="#09090b", border_width=1, border_color="#27272a", corner_radius=6)
        progress_card.pack(fill="x", padx=15, pady=(10, 15))
        
        prog_header = ctk.CTkFrame(progress_card, fg_color="transparent")
        prog_header.pack(fill="x", padx=12, pady=(10, 4))
        
        lbl_title = ctk.CTkLabel(prog_header, text="Merging Progress", font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"), text_color="#71717a")
        lbl_title.pack(side="left")
        
        self.lbl_progress = ctk.CTkLabel(prog_header, text="0%", font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"), text_color="#3b82f6")
        self.lbl_progress.pack(side="right")
        
        self.progress_bar = ctk.CTkProgressBar(progress_card, height=6, fg_color="#18181b", progress_color="#3b82f6", corner_radius=3)
        self.progress_bar.set(0)
        self.progress_bar.pack(fill="x", padx=12, pady=(0, 12))

    def check_merger_exe(self):
        if not os.path.exists(self.merger_exe_path):
            self.write_log(f"[WARNING]: C++ core engine not found at: {self.merger_exe_path}\n"
                           f"Please ensure manga-psd-merger.exe is sitting next to this application.\n")
            self.btn_merge.configure(state="disabled")
        else:
            self.write_log(f"[INFO]: C++ core engine discovered successfully.\n"
                           f"Ready to process chapters.\n")

    def write_log(self, text):
        # Print to stdout/stderr in the background (helpful for compile diagnostics)
        print(text, end="")
        if hasattr(self, 'txt_console') and self.txt_console:
            def _write():
                self.txt_console.configure(state="normal")
                self.txt_console.insert("end", text)
                self.txt_console.see("end")
                self.txt_console.configure(state="disabled")
            self.after(0, _write)

    def clear_log(self):
        if hasattr(self, 'txt_console') and self.txt_console:
            def _clear():
                self.txt_console.configure(state="normal")
                self.txt_console.delete("1.0", "end")
                self.txt_console.configure(state="disabled")
            self.after(0, _clear)

    def browse_folder(self):
        selected = filedialog.askdirectory(initialdir=self.exe_dir, title="Select Manga Chapter Folder")
        if selected:
            # Normalize path
            selected = os.path.normpath(selected)
            self.path_var.set(selected)

    def on_path_var_changed(self, *args):
        path_text = self.path_var.get().strip()
        cleaned = path_text
        if cleaned.startswith('"') and cleaned.endswith('"'):
            cleaned = cleaned[1:-1]
        elif cleaned.startswith("'") and cleaned.endswith("'"):
            cleaned = cleaned[1:-1]
            
        if cleaned != path_text:
            self.path_var.set(cleaned)
            return
            
        # Reset merge status on path changes to allow immediate reprocessing
        self.merging_in_progress = False
        self.btn_merge.configure(state="normal", text="Start PSD Merge")
        self.progress_bar.set(0)
        self.lbl_progress.configure(text="Progress: 0%")
            
        if os.path.exists(cleaned) and os.path.isdir(cleaned):
            self.scan_and_update_folders(cleaned)
        else:
            self.combo_clean.configure(values=["(No folders found)"])
            self.combo_clean.set("(No folders found)")

    def paste_text(self):
        try:
            # Safely fetch unicode string from OS clipboard
            text = self.clipboard_get()
            if text:
                text = text.strip()
                # Clean outer quotes if any
                if text.startswith('"') and text.endswith('"'):
                    text = text[1:-1]
                elif text.startswith("'") and text.endswith("'"):
                    text = text[1:-1]
                
                # Replace the entry box content completely
                self.path_var.set(text)
        except Exception:
            pass
        return "break"

    def show_context_menu(self, event):
        from tkinter import Menu
        # Set focus to the entry box so copy/cut/paste commands operate on it
        self.entry_path.focus_set()
        
        menu = Menu(self, tearoff=0)
        menu.add_command(label="Cut", command=lambda: event.widget.event_generate("<<Cut>>"))
        menu.add_command(label="Copy", command=lambda: event.widget.event_generate("<<Copy>>"))
        menu.add_command(label="Paste", command=self.paste_text)
        
        # Style menu dark
        menu.configure(bg="#18181b", fg="#f4f4f5", activebackground="#2563eb", activeforeground="#ffffff")
        
        try:
            menu.post(event.x_root, event.y_root)
        except Exception:
            pass

    def scan_and_update_folders(self, folder_path):
        try:
            items = os.listdir(folder_path)
            # Find subfolders
            subfolders = [i for i in items if os.path.isdir(os.path.join(folder_path, i)) and i.lower() != "output_psds"]
            
            # Simple check for raw images in current folder
            valid_images = [i for i in items if os.path.isfile(os.path.join(folder_path, i)) and self.is_image(i)]
            
            if subfolders:
                self.clean_folders_list = subfolders
                self.combo_clean.configure(values=subfolders)
                # Auto-select the first one containing 'clean' or similar, otherwise first element
                cleaned_folder = next((s for s in subfolders if "clean" in s.lower() or "cleaned" in s.lower()), subfolders[0])
                self.combo_clean.set(cleaned_folder)
                
                self.write_log(f"[INFO]: Scanned folder. Found {len(valid_images)} RAW images and {len(subfolders)} subfolders.\n")
            else:
                self.clean_folders_list = []
                self.combo_clean.configure(values=["(No folders found)"])
                self.combo_clean.set("(No folders found)")
                self.write_log(f"[INFO]: Scanned folder. Found {len(valid_images)} RAW images but no subfolders.\n")
        except Exception as e:
            self.write_log(f"[ERROR]: Failed to scan folder: {str(e)}\n")

    def is_image(self, filename):
        ext = os.path.splitext(filename)[1].lower()
        return ext in [".jpg", ".jpeg", ".png", ".webp"]

    def start_merge(self):
        if self.merging_in_progress:
            return
            
        chapter_path = self.entry_path.get().strip()
        clean_subfolder = self.combo_clean.get()
        
        if not chapter_path or not os.path.exists(chapter_path):
            self.write_log("[ERROR]: Please select a valid chapter folder path.\n")
            return
            
        if clean_subfolder == "(No folders found)" or not clean_subfolder:
            self.write_log("[ERROR]: Please choose a valid clean images subfolder.\n")
            return
            
        # Get selection index
        try:
            selection_idx = self.clean_folders_list.index(clean_subfolder) + 1
        except ValueError:
            selection_idx = 1
            
        self.merging_in_progress = True
        self.btn_merge.configure(state="disabled", text="Merging...")
        self.progress_bar.set(0)
        self.lbl_progress.configure(text="Progress: 0%")
        self.clear_log()
        
        self.write_log(f"[START]: Initiating PSD merge on chapter:\n{chapter_path}\n"
                       f"Selected clean directory: {clean_subfolder} (Index: {selection_idx})\n"
                       f"---------------------------------------------------\n")
        
        # Run subprocess execution in a background thread to prevent GUI freezing
        threading.Thread(
            target=self.execute_merger_subprocess,
            args=(chapter_path, selection_idx),
            daemon=True
        ).start()

    def execute_merger_subprocess(self, chapter_path, selection_idx):
        try:
            # Spawn C++ merger
            p = subprocess.Popen(
                [self.merger_exe_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT, # Redirect stderr to stdout to prevent deadlock
                encoding='utf-8',
                errors='replace',
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW # Don't spawn separate command prompt window
            )
            
            # Write chapter directory path as the first input
            p.stdin.write(chapter_path + "\n")
            p.stdin.flush()
            
            # Variables for tracking progress
            total_pages = 0
            completed_pages = 0
            
            # Read stdout line by line
            while True:
                line = p.stdout.readline()
                if not line:
                    break
                
                # Clean up carriage returns
                clean_line = line.strip()
                if not clean_line:
                    continue
                    
                # Write to GUI log textbox safely (write_log uses self.after(0) internally)
                self.write_log(clean_line + "\n")
                
                # Check for prompts and send clean directory index
                if "cleaned-image folders found:" in clean_line:
                    # Stdin is waiting for the index selection
                    p.stdin.write(str(selection_idx) + "\n")
                    p.stdin.flush()
                
                # Extract page counts for progress
                # Format: "[INFO] Processing 14 matched pages with 2 worker(s)..."
                if "Processing" in clean_line and "matched pages" in clean_line:
                    try:
                        parts = clean_line.split()
                        total_pages = int(parts[2])
                        self.after(0, lambda t=total_pages: self.lbl_progress.configure(text=f"Progress: 0% (0/{t})"))
                    except Exception:
                        total_pages = 0
                        
                # Extract page completions
                # Format: "[OK] 001.jpg + 001.jpg -> 001.psd"
                if "[OK]" in clean_line and "->" in clean_line and ".psd" in clean_line:
                    completed_pages += 1
                    if total_pages > 0:
                        pct = completed_pages / total_pages
                        self.after(0, lambda p_val=pct, c=completed_pages, t=total_pages: (
                            self.progress_bar.set(p_val),
                            self.lbl_progress.configure(text=f"Progress: {int(p_val * 100)}% ({c}/{t})")
                        ))
            
            # Wait for process exit code
            p.wait()
            
            # Handle final UI updates
            self.after(100, lambda: self.on_merge_complete(p.returncode))
            
        except Exception as e:
            self.write_log(f"\n[FATAL ERROR]: Failed to execute merger subprocess:\n{str(e)}\n")
            self.after(100, self.on_merge_error)

    def on_merge_complete(self, exit_code):
        self.merging_in_progress = False
        self.btn_merge.configure(state="normal", text="Start PSD Merge")
        
        if exit_code == 0:
            self.progress_bar.set(1.0)
            self.lbl_progress.configure(text="Progress: 100% (Completed)")
            self.write_log(f"---------------------------------------------------\n"
                           f"[SUCCESS]: All pages merged successfully into PSD format!\n")
            # Clear console logs since it is hidden, but keep a popup
            messagebox.showinfo("Success", "All pages merged successfully into PSD format!")
        else:
            self.write_log(f"---------------------------------------------------\n"
                           f"[ERROR]: Subprocess exited with error code {exit_code}.\n")
            messagebox.showerror("Error", f"Merging failed! Core engine exited with error code {exit_code}.")

    def on_merge_error(self):
        self.merging_in_progress = False
        self.btn_merge.configure(state="normal", text="Start PSD Merge")
        messagebox.showerror("Error", "Failed to execute the merger process! Please check if the path is correct.")

if __name__ == "__main__":
    app = MangaMergerApp()
    app.mainloop()
