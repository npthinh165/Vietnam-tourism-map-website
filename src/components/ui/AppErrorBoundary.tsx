import { Component, type ReactNode } from "react";

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="page-shell max-w-xl">
          <div className="panel p-6" role="alert">
            <h1 className="section-title">Chưa tải được ứng dụng</h1>
            <p className="my-4 text-sm">
              Vui lòng tải lại trang. Các hành trình đã lưu vẫn nằm trong tài
              khoản của bạn.
            </p>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Tải lại trang
            </button>
          </div>
        </main>
      );
    return this.props.children;
  }
}
