import sys
import os

def run_inference(input_audio, output_audio, pth_path, index_path, pitch=0):
    try:
        from rvc_python.infer import RVCInference
        rvc = RVCInference(device="cpu")
        rvc.load_model(pth_path, index_path=index_path)
        rvc.infer_file(input_audio, output_audio, f0_method="rmvpe", f0_up_key=pitch)
        print("RVC_SUCCESS")
    except Exception as e:
        print(f"RVC_ERROR: {e}")
        # Fallback copy if RVC fails
        import shutil
        shutil.copyfile(input_audio, output_audio)

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python rvc_infer.py <input_audio> <output_audio> <pth_path> <index_path> [pitch]")
        sys.exit(1)
        
    input_audio = sys.argv[1]
    output_audio = sys.argv[2]
    pth_path = sys.argv[3]
    index_path = sys.argv[4]
    pitch = int(sys.argv[5]) if len(sys.argv) > 5 else 0

    run_inference(input_audio, output_audio, pth_path, index_path, pitch)
