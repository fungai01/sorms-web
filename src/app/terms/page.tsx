import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng - SORMS',
  description: 'Điều khoản và điều kiện sử dụng hệ thống SORMS - Hệ thống quản lý nhà công vụ thông minh',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Điều khoản sử dụng</h1>
          <p className="text-gray-600">Cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Chấp nhận điều khoản</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Bằng việc truy cập và sử dụng hệ thống SORMS (Smart Office Residence Management System), 
              bạn đồng ý tuân thủ và bị ràng buộc bởi các điều khoản và điều kiện sử dụng được nêu trong tài liệu này. 
              Nếu bạn không đồng ý với bất kỳ phần nào của các điều khoản này, vui lòng không sử dụng dịch vụ của chúng tôi.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Định nghĩa</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>
                <strong>Hệ thống SORMS:</strong> Là nền tảng quản lý nhà công vụ thông minh, bao gồm các tính năng 
                quản lý phòng ở, dịch vụ, thanh toán và các chức năng liên quan.
              </p>
              <p>
                <strong>Người dùng:</strong> Là cá nhân hoặc tổ chức được cấp quyền truy cập và sử dụng hệ thống SORMS.
              </p>
              <p>
                <strong>Tài khoản:</strong> Là thông tin đăng nhập và dữ liệu liên quan đến người dùng trong hệ thống.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Đăng ký và tài khoản</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>
                Để sử dụng hệ thống SORMS, bạn cần đăng ký tài khoản thông qua Google OAuth. 
                Bạn có trách nhiệm:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Cung cấp thông tin chính xác, đầy đủ và cập nhật</li>
                <li>Bảo mật thông tin đăng nhập và không chia sẻ với bên thứ ba</li>
                <li>Thông báo ngay cho chúng tôi nếu phát hiện vi phạm bảo mật</li>
                <li>Chịu trách nhiệm cho mọi hoạt động diễn ra dưới tài khoản của bạn</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Quyền và trách nhiệm của người dùng</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p><strong>Người dùng có quyền:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Truy cập và sử dụng các tính năng theo quyền hạn được cấp</li>
                <li>Đặt phòng, quản lý đơn hàng và thanh toán dịch vụ</li>
                <li>Xem lịch sử giao dịch và báo cáo liên quan</li>
              </ul>
              <p className="mt-4"><strong>Người dùng có trách nhiệm:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Sử dụng hệ thống đúng mục đích và tuân thủ pháp luật</li>
                <li>Không thực hiện các hành vi gây hại hoặc cản trở hoạt động của hệ thống</li>
                <li>Không chia sẻ, sao chép hoặc phân phối nội dung trái phép</li>
                <li>Bảo vệ thông tin cá nhân và dữ liệu của mình</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Quyền sở hữu trí tuệ</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Toàn bộ nội dung, thiết kế, logo, phần mềm và các tài sản trí tuệ khác của hệ thống SORMS 
              đều thuộc quyền sở hữu của chúng tôi hoặc các bên cấp phép. Bạn không được phép sao chép, 
              sửa đổi, phân phối hoặc khai thác thương mại bất kỳ phần nào của hệ thống mà không có sự 
              cho phép bằng văn bản từ chúng tôi.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Thanh toán và hoàn tiền</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>
                Người dùng có trách nhiệm thanh toán đầy đủ các khoản phí phát sinh từ việc sử dụng dịch vụ. 
                Chính sách hoàn tiền sẽ được áp dụng theo quy định cụ thể của từng loại dịch vụ và được thông báo 
                trước khi thực hiện giao dịch.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Bảo mật thông tin</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Chúng tôi cam kết bảo vệ thông tin cá nhân của người dùng theo các tiêu chuẩn bảo mật cao nhất. 
              Chi tiết về cách chúng tôi thu thập, sử dụng và bảo vệ thông tin được mô tả trong 
              <a href="/policy" className="text-blue-600 hover:text-blue-800 underline ml-1">Chính sách bảo mật</a>.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Từ chối trách nhiệm</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Hệ thống SORMS được cung cấp "nguyên trạng" và chúng tôi không đảm bảo rằng hệ thống sẽ hoạt động 
              liên tục, không bị gián đoạn hoặc không có lỗi. Chúng tôi không chịu trách nhiệm cho bất kỳ thiệt hại 
              nào phát sinh từ việc sử dụng hoặc không thể sử dụng hệ thống.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Thay đổi điều khoản</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Chúng tôi có quyền cập nhật, sửa đổi các điều khoản này vào bất kỳ lúc nào. Các thay đổi sẽ có hiệu lực 
              ngay sau khi được đăng tải trên hệ thống. Việc bạn tiếp tục sử dụng dịch vụ sau khi có thay đổi được 
              coi là bạn đã chấp nhận các điều khoản mới.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Liên hệ</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Nếu bạn có bất kỳ câu hỏi nào về các điều khoản sử dụng này, vui lòng liên hệ với chúng tôi thông qua 
              các kênh hỗ trợ chính thức của hệ thống SORMS.
            </p>
          </section>

          {/* Footer */}
          <div className="pt-8 mt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              © 2025 SORMS – Hệ thống quản lý nhà công vụ thông minh
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

