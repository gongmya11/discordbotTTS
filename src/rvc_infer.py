import sys
import os
import json
import shutil

# Đảm bảo stdout ghi ngay lập tức không bị đệm (unbuffered)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

def load_rvc():
    try:
        from rvc_python.infer import RVCInference
        return RVCInference
    except Exception as e:
        print(f"INIT_ERROR: {e}", file=sys.stderr, flush=True)
        return None

def main_daemon():
    print("STATUS:STARTING", flush=True)
    RVCInference = load_rvc()
    if RVCInference is None:
        print("STATUS:FAILED_IMPORT", flush=True)
    else:
        print("STATUS:READY", flush=True)

    rvc_instance = None
    current_pth = None

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req = None
        try:
            req = json.loads(line)
            input_audio = req.get("input")
            output_audio = req.get("output")
            pth_path = req.get("pth")
            index_path = req.get("index")
            pitch = int(req.get("pitch", 0))
            f0_method = req.get("f0_method", "pm") # 'pm' tối ưu tốc độ xử lý trên CPU

            if not RVCInference:
                if input_audio and output_audio and os.path.exists(input_audio):
                    shutil.copyfile(input_audio, output_audio)
                print(json.dumps({"status": "fallback", "message": "rvc_python not installed"}), flush=True)
                continue

            if rvc_instance is None:
                rvc_instance = RVCInference(device="cpu")

            if current_pth != pth_path:
                idx = index_path if index_path and os.path.exists(index_path) else None
                rvc_instance.load_model(pth_path, index_path=idx)
                current_pth = pth_path

            rvc_instance.infer_file(input_audio, output_audio, f0_method=f0_method, f0_up_key=pitch)
            print(json.dumps({"status": "success", "output": output_audio}), flush=True)

        except Exception as e:
            if req and "input" in req and "output" in req and os.path.exists(req["input"]):
                try:
                    shutil.copyfile(req["input"], req["output"])
                except Exception:
                    pass
            print(json.dumps({"status": "error", "message": str(e)}), flush=True)

def main_oneshot(input_audio, output_audio, pth_path, index_path, pitch=0):
    try:
        from rvc_python.infer import RVCInference
        rvc = RVCInference(device="cpu")
        idx = index_path if index_path and os.path.exists(index_path) else None
        rvc.load_model(pth_path, index_path=idx)
        rvc.infer_file(input_audio, output_audio, f0_method="pm", f0_up_key=pitch)
        print("RVC_SUCCESS", flush=True)
    except Exception as e:
        print(f"RVC_ERROR: {e}", file=sys.stderr, flush=True)
        if os.path.exists(input_audio):
            shutil.copyfile(input_audio, output_audio)

if __name__ == "__main__":
    if len(sys.argv) >= 5:
        input_audio = sys.argv[1]
        output_audio = sys.argv[2]
        pth_path = sys.argv[3]
        index_path = sys.argv[4]
        pitch = int(sys.argv[5]) if len(sys.argv) > 5 else 0
        main_oneshot(input_audio, output_audio, pth_path, index_path, pitch)
    else:
        main_daemon()

