export const SOCIAL_ASSISTANCE_FEATURES = [
    { name: "An sinh - Tiếp nhận", code: "social_assistance_intake", description: "Tiếp nhận và rà soát yêu cầu hỗ trợ an sinh xã hội", path: "/an-sinh/tiep-nhan", groupName: "social_assistance", orderIndex: 1, icon: "GridIcon", requiredPermissionCode: "social_assistance.request.view" },
    { name: "An sinh - Cổng công khai", code: "social_assistance_portal", description: "Cấu hình tiếp nhận và công khai chương trình an sinh xã hội", path: "/an-sinh/cong-khai", groupName: "social_assistance", orderIndex: 2, icon: "PlugInIcon", requiredPermissionCode: "social_assistance.portal.manage" },
    { name: "An sinh - Chương trình", code: "social_assistance_programs", description: "Quản lý chương trình an sinh xã hội", path: "/an-sinh/chuong-trinh", groupName: "social_assistance", orderIndex: 3, icon: "PageIcon", requiredPermissionCode: "social_assistance.program.view" },
    { name: "An sinh - Cam kết ủng hộ", code: "social_assistance_pledges", description: "Rà soát và đối soát cam kết ủng hộ", path: "/an-sinh/tai-tro", groupName: "social_assistance", orderIndex: 4, icon: "PieChartIcon", requiredPermissionCode: "social_assistance.pledge.view" },
    { name: "An sinh - Phân bổ hỗ trợ", code: "social_assistance_allocations", description: "Phân bổ và theo dõi việc thực hiện hỗ trợ", path: "/an-sinh/phan-bo", groupName: "social_assistance", orderIndex: 5, icon: "BoxCubeIcon", requiredPermissionCode: "social_assistance.allocation.view" },
    { name: "An sinh - Công văn đa thành phần", code: "social_assistance_distribution_orders", description: "Quản lý công văn hỗ trợ theo thành phần, địa bàn, tổ chức và chu kỳ", path: "/an-sinh/phan-bo", groupName: "social_assistance", orderIndex: 6, icon: "FileTextIcon", requiredPermissionCode: "social_assistance.distribution_batch.view" },
    { name: "An sinh - Danh sách thụ hưởng riêng tư", code: "social_assistance_beneficiaries", description: "Quản lý danh sách hộ và người thụ hưởng theo phạm vi địa bàn hoặc tổ chức", path: "/an-sinh/phan-bo", groupName: "social_assistance", orderIndex: 7, icon: "UsersIcon", requiredPermissionCode: "social_assistance.beneficiary.view" },
    { name: "An sinh - Điều phối", code: "social_assistance_dashboard", description: "Tổng hợp tiếp nhận, cam kết, tiếp nhận và kết quả hỗ trợ", path: "/an-sinh/dieu-phoi", groupName: "social_assistance", orderIndex: 8, icon: "PieChartIcon", requiredPermissionCode: "social_assistance.report.read" },
    { name: "An sinh - Duyệt kết quả công khai", code: "social_assistance_publications", description: "Xem trước và duyệt số liệu an sinh công khai", path: "/an-sinh/duyet-ket-qua", groupName: "social_assistance", orderIndex: 9, icon: "PageIcon", requiredPermissionCode: "social_assistance.publication.manage" }
] as const;

export const SOCIAL_ASSISTANCE_PERMISSIONS = [
    ["social_assistance.request.view", "View social assistance requests"],
    ["social_assistance.request.review", "Review social assistance requests"],
    ["social_assistance.program.view", "View social assistance programs"],
    ["social_assistance.program.manage", "Manage social assistance programs"],
    ["social_assistance.pledge.view", "View social assistance pledges"],
    ["social_assistance.pledge.reconcile", "Reconcile social assistance pledges"],
    ["social_assistance.allocation.view", "View social assistance allocations"],
    ["social_assistance.allocation.manage", "Manage social assistance allocations"],
    ["social_assistance.distribution_batch.view", "View locality allocation batches"],
    ["social_assistance.distribution_batch.manage", "Manage locality allocation batches"],
    ["social_assistance.distribution_batch.publish", "Publish locality allocation batches"],
    ["social_assistance.beneficiary.view", "View private social assistance beneficiaries"],
    ["social_assistance.beneficiary.manage", "Manage private social assistance beneficiaries"],
    ["social_assistance.report.read", "View social assistance reports"],
    ["social_assistance.publication.manage", "Manage public social assistance results"],
    ["social_assistance.portal.manage", "Manage social assistance public portal"]
] as const;
