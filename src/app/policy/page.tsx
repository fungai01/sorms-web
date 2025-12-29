import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chính sách bảo mật - SORMS',
  description: 'Chính sách bảo mật và quyền riêng tư của hệ thống SORMS - Hệ thống quản lý nhà công vụ thông minh',
};

export default function PolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Chính sách bảo mật</h1>
          <p className="text-gray-600">Cập nhật lần cuối: {new Date().toLocaleDateString('vi-VN')}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
          {/* Introduction */}
          <section>
            <p className="text-gray-700 leading-relaxed mb-4">
              Chúng tôi tại SORMS (Smart Office Residence Management System) cam kết bảo vệ quyền riêng tư và 
              thông tin cá nhân của người dùng. Chính sách bảo mật này mô tả cách chúng tôi thu thập, sử dụng, 
              lưu trữ và bảo vệ thông tin của bạn khi sử dụng hệ thống.
            </p>
          </section>

          {/* Section 1 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Thông tin chúng tôi thu thập</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p><strong>1.1. Thông tin đăng nhập:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Email từ tài khoản Google OAuth</li>
                <li>Thông tin hồ sơ cơ bản từ Google (tên, ảnh đại diện)</li>
              </ul>
              <p className="mt-4"><strong>1.2. Thông tin sử dụng dịch vụ:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Lịch sử đặt phòng và giao dịch</li>
                <li>Thông tin thanh toán (được xử lý bởi các nhà cung cấp thanh toán bên thứ ba)</li>
                <li>Dữ liệu sử dụng hệ thống và tương tác</li>
              </ul>
              <p className="mt-4"><strong>1.3. Thông tin kỹ thuật:</strong></p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Địa chỉ IP, loại trình duyệt, thiết bị sử dụng</li>
                <li>Logs truy cập và hoạt động trong hệ thống</li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Mục đích sử dụng thông tin</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>Chúng tôi sử dụng thông tin thu thập được để:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Cung cấp và duy trì dịch vụ hệ thống SORMS</li>
                <li>Xác thực danh tính và quản lý tài khoản người dùng</li>
                <li>Xử lý đặt phòng, thanh toán và các giao dịch khác</li>
                <li>Cải thiện chất lượng dịch vụ và trải nghiệm người dùng</li>
                <li>Gửi thông báo quan trọng về dịch vụ</li>
                <li>Tuân thủ các nghĩa vụ pháp lý và quy định</li>
                <li>Phát hiện và ngăn chặn gian lận, lạm dụng hệ thống</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Bảo vệ thông tin</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>
                Chúng tôi áp dụng các biện pháp bảo mật kỹ thuật và tổ chức phù hợp để bảo vệ thông tin của bạn:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Mã hóa dữ liệu trong quá trình truyền tải (HTTPS/TLS)</li>
                <li>Mã hóa dữ liệu nhạy cảm khi lưu trữ</li>
                <li>Kiểm soát truy cập nghiêm ngặt và xác thực đa yếu tố</li>
                <li>Giám sát và phát hiện các hoạt động bất thường</li>
                <li>Đào tạo nhân viên về bảo mật thông tin</li>
                <li>Đánh giá và cập nhật định kỳ các biện pháp bảo mật</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Chia sẻ thông tin</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>Chúng tôi không bán hoặc cho thuê thông tin cá nhân của bạn. Chúng tôi chỉ chia sẻ thông tin trong các trường hợp sau:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Nhà cung cấp dịch vụ:</strong> Các đối tác hỗ trợ vận hành hệ thống (lưu trữ, thanh toán) với cam kết bảo mật</li>
                <li><strong>Yêu cầu pháp lý:</strong> Khi có yêu cầu từ cơ quan nhà nước có thẩm quyền</li>
                <li><strong>Bảo vệ quyền lợi:</strong> Để bảo vệ quyền, tài sản hoặc an toàn của chúng tôi và người dùng</li>
                <li><strong>Với sự đồng ý:</strong> Khi bạn đồng ý rõ ràng cho việc chia sẻ thông tin</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Quyền của người dùng</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              <p>Bạn có các quyền sau đối với thông tin cá nhân của mình:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Quyền truy cập:</strong> Yêu cầu xem thông tin cá nhân mà chúng tôi lưu trữ</li>
                <li><strong>Quyền chỉnh sửa:</strong> Cập nhật hoặc sửa đổi thông tin không chính xác</li>
                <li><strong>Quyền xóa:</strong> Yêu cầu xóa thông tin cá nhân (trừ khi cần lưu trữ theo quy định pháp luật)</li>
                <li><strong>Quyền phản đối:</strong> Phản đối việc xử lý thông tin cho mục đích nhất định</li>
                <li><strong>Quyền rút lại đồng ý:</strong> Rút lại sự đồng ý đã cấp trước đó</li>
                <li><strong>Quyền khiếu nại:</strong> Khiếu nại với cơ quan bảo vệ dữ liệu nếu bạn cho rằng quyền của mình bị vi phạm</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Cookie và công nghệ theo dõi</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Hệ thống SORMS sử dụng cookie và các công nghệ tương tự để cải thiện trải nghiệm người dùng, 
              xác thực phiên đăng nhập và phân tích sử dụng. Bạn có thể quản lý cài đặt cookie thông qua 
              trình duyệt của mình, tuy nhiên việc tắt cookie có thể ảnh hưởng đến chức năng của hệ thống.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Lưu trữ dữ liệu</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Chúng tôi lưu trữ thông tin cá nhân của bạn trong thời gian cần thiết để thực hiện các mục đích 
              đã nêu trong chính sách này, hoặc theo yêu cầu của pháp luật. Khi không còn cần thiết, chúng tôi sẽ 
              xóa hoặc ẩn danh hóa thông tin một cách an toàn.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Bảo mật dữ liệu của trẻ em</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Hệ thống SORMS không dành cho trẻ em dưới 18 tuổi. Chúng tôi không cố ý thu thập thông tin từ trẻ em. 
              Nếu phát hiện thông tin của trẻ em được thu thập, chúng tôi sẽ xóa ngay lập tức.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Thay đổi chính sách</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Chúng tôi có thể cập nhật chính sách bảo mật này theo thời gian. Các thay đổi quan trọng sẽ được 
              thông báo rõ ràng trên hệ thống hoặc qua email. Chúng tôi khuyến khích bạn xem lại chính sách này 
              định kỳ để nắm được cách chúng tôi bảo vệ thông tin của bạn.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Liên hệ</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Nếu bạn có bất kỳ câu hỏi, yêu cầu hoặc khiếu nại về chính sách bảo mật này hoặc cách chúng tôi xử lý 
              thông tin cá nhân, vui lòng liên hệ với chúng tôi thông qua các kênh hỗ trợ chính thức của hệ thống SORMS.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Để thực hiện các quyền của mình, bạn có thể truy cập vào phần cài đặt tài khoản trong hệ thống hoặc 
              gửi yêu cầu trực tiếp đến bộ phận hỗ trợ.
            </p>
          </section>

          {/* Footer */}
          <div className="pt-8 mt-8 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center">
              © 2025 SORMS – Hệ thống quản lý nhà công vụ thông minh
            </p>
            <p className="text-sm text-gray-500 text-center mt-2">
              Xem thêm: <a href="/terms" className="text-blue-600 hover:text-blue-800 underline">Điều khoản sử dụng</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}



