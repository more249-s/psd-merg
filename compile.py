import os
import subprocess
import shutil
import sys

def compile_app():
    print("===================================================")
    print("Manga PSD Merger GUI - Python Compiler")
    print("===================================================")
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    icon_path = os.path.join(current_dir, "app_icon.ico")
    script_path = os.path.join(current_dir, "gui.py")
    output_name = "manga-psd-merger-gui"
    final_exe_name = f"{output_name}.exe"
    final_exe_path = os.path.join(current_dir, final_exe_name)
    
    # Terminate any running instance of the GUI executable to prevent file locks
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/f", "/im", "manga-psd-merger-gui.exe"], 
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass
        
    # 1. Check icon and script
    if not os.path.exists(script_path):
        print(f"[ERROR]: gui.py not found")
        sys.exit(1)
        
    if not os.path.exists(icon_path):
        print(f"[WARNING]: app_icon.ico not found at {icon_path}. Compilation will proceed without custom icon.")
        icon_arg = ""
    else:
        print("  [OK] app_icon.ico discovered.")
        icon_arg = f'--icon="{icon_path}"'
        
    # 2. Run PyInstaller
    print("[1/3] Packaging application with PyInstaller (One-File, No-Console)...")
    
    pyinstaller_cmd = [
        "pyinstaller",
        "--noconsole",
        "--onefile",
        "--collect-all", "customtkinter",
        "--add-data", "manga-psd-merger.exe;.",
        "--add-data", "app_icon.ico;.",
        f"--name={output_name}",
    ]
    if icon_arg:
        pyinstaller_cmd.append(f"--icon={icon_path}")
        
    pyinstaller_cmd.append("gui.py")
    
    print("Running PyInstaller packager...")
    try:
        # Run process synchronously and inherit output
        subprocess.run(pyinstaller_cmd, check=True, cwd=current_dir)
        print("  [OK] Standalone executable compiled successfully in dist/ folder.")
    except subprocess.CalledProcessError as e:
        print(f"[FATAL BUILD ERROR]: PyInstaller command failed. Error: {str(e)}")
        sys.exit(1)
        
    # 3. Copy final executable to project root
    dist_exe_path = os.path.join(current_dir, "dist", final_exe_name)
    if os.path.exists(dist_exe_path):
        print(f"[2/3] Moving compiled EXE to project root...")
        
        # If destination file exists and is locked, try to delete it first
        if os.path.exists(final_exe_path):
            try:
                os.remove(final_exe_path)
            except Exception as err:
                safe_err = str(err).encode('ascii', 'ignore').decode('ascii')
                print(f"[ERROR]: Could not remove old executable. It might be running or locked. {safe_err}")
                sys.exit(1)
                
        shutil.copy2(dist_exe_path, final_exe_path)
        print(f"  [OK] Executable moved to root folder.")
    else:
        print(f"[FATAL BUILD ERROR]: Compiled executable not found at {dist_exe_path}")
        sys.exit(1)
        
    # 4. Clean up temporary build artifacts
    print("[3/3] Cleaning up temporary build directories...")
    
    build_dir = os.path.join(current_dir, "build")
    dist_dir = os.path.join(current_dir, "dist")
    spec_file = os.path.join(current_dir, f"{output_name}.spec")
    
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir, ignore_errors=True)
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir, ignore_errors=True)
    if os.path.exists(spec_file):
        os.remove(spec_file)
        
    print("  [OK] Build directories cleaned up successfully.")
    print("---------------------------------------------------")
    print(f"[SUCCESS] Native standalone executable is ready.")
    print("===================================================")

if __name__ == "__main__":
    compile_app()
