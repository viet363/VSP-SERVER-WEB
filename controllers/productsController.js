import React, { useEffect, useState } from 'react';
import Table from '../components/table/Table';
import api from '../api';

const productTableHead = [
    'STT',
    'ID',
    'Tên sản phẩm',
    'Giá',
    'Trạng thái',
    'Hình ảnh',
    'Danh mục',
    'Hành động'
];

// Component xử lý lỗi hình ảnh
const ImageWithFallback = ({ src, alt, ...props }) => {
    const [imgError, setImgError] = useState(false);

    if (imgError || !src) {
        return <span style={{ color: '#aaa', fontStyle: 'italic' }}>No image</span>;
    }

    return (
        <img 
            src={src} 
            alt={alt}
            onError={() => setImgError(true)}
            {...props}
        />
    );
};

// Component Modal quản lý thông số
const SpecsModal = ({ productId, productName, categoryId, onClose, onSave }) => {
    const [specs, setSpecs] = useState([]);
    const [availableSpecs, setAvailableSpecs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newSpec, setNewSpec] = useState({ Spec_key: '', Spec_value: '' });
    const [selectedSpec, setSelectedSpec] = useState('');
    const [useAvailableSpec, setUseAvailableSpec] = useState(false);

    useEffect(() => {
        fetchSpecsData();
    }, [productId, categoryId]);

    const fetchSpecsData = async () => {
        try {
            setLoading(true);
            
            // Lấy thông số của sản phẩm - SỬA ENDPOINT
            const productSpecsRes = await api.get(`/specs/products/${productId}/specs`);
            console.log('Product specs API response:', productSpecsRes.data);
            
            // Chuyển đổi dữ liệu từ API về định dạng phù hợp
            const processedSpecs = (productSpecsRes.data || []).map(item => ({
                Id: item.Id,
                key: item.Spec_key || item.key || '',
                value: item.Spec_value || item.value || ''
            }));
            
            console.log('Processed specs:', processedSpecs);
            setSpecs(processedSpecs);
            
            // Lấy thông số mẫu từ danh mục
            if (categoryId) {
                try {
                    const categorySpecsRes = await api.get(`/specs/category/${categoryId}`);
                    console.log('Category specs API response:', categorySpecsRes.data);
                    setAvailableSpecs(categorySpecsRes.data || []);
                } catch (err) {
                    console.log('Không thể lấy thông số theo danh mục:', err.message);
                    setAvailableSpecs([]);
                }
            } else {
                setAvailableSpecs([]);
            }
            
            setLoading(false);
        } catch (err) {
            console.error('Error fetching specs:', err);
            setLoading(false);
        }
    };

    const handleAddSpec = () => {
        if (useAvailableSpec && selectedSpec) {
            // Tìm thông tin của spec đã chọn
            const selectedSpecObj = availableSpecs.find(spec => spec.Spec_name === selectedSpec);
            if (selectedSpecObj) {
                const specKey = selectedSpecObj.Spec_name.trim();
                if (!specKey) {
                    alert('Tên thông số không được để trống');
                    return;
                }
                
                const specExists = specs.find(s => s.key === specKey);
                if (!specExists) {
                    setSpecs([...specs, { 
                        key: specKey,
                        value: '',
                        Id: null
                    }]);
                    setSelectedSpec('');
                } else {
                    alert('Thông số này đã tồn tại!');
                }
            }
        } else if (newSpec.Spec_key && newSpec.Spec_value) {
            // Thêm thông số tùy chỉnh
            const specKey = newSpec.Spec_key.trim();
            if (!specKey) {
                alert('Tên thông số không được để trống');
                return;
            }
            
            const specExists = specs.find(s => s.key === specKey);
            if (!specExists) {
                setSpecs([...specs, { 
                    key: specKey,
                    value: newSpec.Spec_value.trim(),
                    Id: null
                }]);
                setNewSpec({ Spec_key: '', Spec_value: '' });
            } else {
                alert('Thông số này đã tồn tại!');
            }
        }
    };

    const handleRemoveSpec = (index) => {
        const newSpecs = [...specs];
        newSpecs.splice(index, 1);
        setSpecs(newSpecs);
    };

    const handleSpecChange = (index, field, value) => {
        const newSpecs = [...specs];
        
        // Nếu đang thay đổi key và value là rỗng, không cho phép
        if (field === 'key' && !value.trim()) {
            alert('Tên thông số không được để trống');
            return;
        }
        
        newSpecs[index][field] = value;
        setSpecs(newSpecs);
    };

    // Debug function để kiểm tra dữ liệu
    const debugSpecs = () => {
        console.log('=== DEBUG SPECS ===');
        specs.forEach((spec, index) => {
            console.log(`Spec ${index + 1}:`, {
                original: spec,
                key: spec.key,
                'key.trim()': spec.key ? spec.key.trim() : 'NULL',
                'key.length': spec.key ? spec.key.length : 0,
                value: spec.value
            });
        });
        console.log('=== END DEBUG ===');
    };

    const handleSave = async () => {
        // Debug trước khi gửi
        debugSpecs();
        
        try {
            // Chuẩn bị dữ liệu để gửi lên server với validation
            const specsToSave = specs.map(spec => {
                // Kiểm tra và đảm bảo Spec_key không bị null/undefined
                const specKey = spec.key || spec.Spec_key || '';
                const specValue = spec.value || spec.Spec_value || '';
                
                return {
                    Id: spec.Id || null,
                    Spec_key: specKey.trim(), // Thêm trim() để loại bỏ khoảng trắng
                    Spec_value: specValue.trim()
                };
            }).filter(spec => {
                // Lọc bỏ các thông số có Spec_key rỗng
                return spec.Spec_key && spec.Spec_key.trim() !== '';
            });
            
            console.log('Saving specs (after validation):', specsToSave);
            
            if (specsToSave.length === 0) {
                alert('Không có thông số hợp lệ để lưu. Vui lòng kiểm tra tên thông số.');
                return;
            }
            
            // Kiểm tra từng thông số trước khi gửi
            const hasEmptyKey = specsToSave.some(spec => !spec.Spec_key || spec.Spec_key.trim() === '');
            if (hasEmptyKey) {
                alert('Có thông số không có tên. Vui lòng kiểm tra lại.');
                return;
            }
            
            // SỬA ENDPOINT - khớp với Postman
            console.log('API URL:', `/specs/products/${productId}/specs`);
            const response = await api.post(`/specs/products/${productId}/specs`, { 
                specs: specsToSave 
            });
            
            console.log('Save response:', response.data);
            alert('Lưu thông số thành công!');
            onSave();
            onClose();
        } catch (err) {
            console.error('=== SAVE ERROR DETAILS ===');
            console.error('Error URL:', err.config?.url);
            console.error('Error Method:', err.config?.method);
            console.error('Error Data:', err.config?.data);
            console.error('Error Status:', err.response?.status);
            console.error('Error Response:', err.response?.data);
            console.error('=== END ERROR DETAILS ===');
            
            alert('Lỗi khi lưu thông số: ' + (err.response?.data?.error || err.message));
        }
    };

    if (loading) {
        return (
            <div className="modal-overlay">
                <div className="modal-content">
                    <div style={{ color: '#e5e7eb', padding: '20px', textAlign: 'center' }}>
                        Đang tải thông số...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3 style={{ color: '#f9fafb', margin: 0 }}>
                        Thông số kỹ thuật: {productName}
                    </h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                
                <div className="modal-body">
                    <div className="add-spec-section">
                        <h4 style={{ color: '#e5e7eb', marginBottom: '15px' }}>Thêm thông số mới</h4>
                        
                        {availableSpecs.length > 0 && (
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                    <input
                                        type="checkbox"
                                        id="useAvailable"
                                        checked={useAvailableSpec}
                                        onChange={(e) => setUseAvailableSpec(e.target.checked)}
                                    />
                                    <label htmlFor="useAvailable" style={{ marginLeft: '8px', color: '#e5e7eb' }}>
                                        Sử dụng thông số mẫu
                                    </label>
                                </div>
                                
                                {useAvailableSpec && (
                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                        <select
                                            value={selectedSpec}
                                            onChange={(e) => setSelectedSpec(e.target.value)}
                                            style={{
                                                flex: 1,
                                                padding: '8px',
                                                border: '1px solid #4b5563',
                                                borderRadius: '4px',
                                                background: '#374151',
                                                color: '#e5e7eb'
                                            }}
                                        >
                                            <option value="">-- Chọn thông số --</option>
                                            {availableSpecs.map((spec, idx) => (
                                                <option key={spec.Id} value={spec.Spec_name}>
                                                    {spec.Spec_name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleAddSpec}
                                            className="btn-spec-add"
                                            disabled={!selectedSpec}
                                        >
                                            Thêm
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {(!useAvailableSpec || availableSpecs.length === 0) && (
                            <div className="custom-spec-input">
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                    <input
                                        type="text"
                                        placeholder="Tên thông số *"
                                        value={newSpec.Spec_key}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            // Kiểm tra nếu chỉ có khoảng trắng
                                            if (value.trim() === '' && value !== '') {
                                                return;
                                            }
                                            setNewSpec({ ...newSpec, Spec_key: value });
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            border: newSpec.Spec_key.trim() === '' ? '1px solid #ef4444' : '1px solid #4b5563',
                                            borderRadius: '4px',
                                            background: '#374151',
                                            color: '#e5e7eb'
                                        }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Giá trị"
                                        value={newSpec.Spec_value}
                                        onChange={(e) => setNewSpec({ ...newSpec, Spec_value: e.target.value })}
                                        style={{
                                            flex: 1,
                                            padding: '8px',
                                            border: '1px solid #4b5563',
                                            borderRadius: '4px',
                                            background: '#374151',
                                            color: '#e5e7eb'
                                        }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddSpec}
                                    className="btn-spec-add"
                                    disabled={!newSpec.Spec_key.trim() || !newSpec.Spec_value.trim()}
                                >
                                    Thêm thông số tùy chỉnh
                                </button>
                                {newSpec.Spec_key.trim() === '' && newSpec.Spec_key !== '' && (
                                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                                        Tên thông số là bắt buộc
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="specs-list-section">
                        <h4 style={{ color: '#e5e7eb', marginBottom: '15px' }}>
                            Danh sách thông số ({specs.length})
                        </h4>
                        
                        {specs.length === 0 ? (
                            <div style={{ color: '#9ca3af', textAlign: 'center', padding: '20px', border: '1px dashed #4b5563', borderRadius: '6px' }}>
                                Chưa có thông số nào. Hãy thêm thông số cho sản phẩm.
                            </div>
                        ) : (
                            <div className="specs-table">
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '10px', borderBottom: '1px solid #4b5563', textAlign: 'left', color: '#e5e7eb' }}>STT</th>
                                            <th style={{ padding: '10px', borderBottom: '1px solid #4b5563', textAlign: 'left', color: '#e5e7eb' }}>Tên thông số</th>
                                            <th style={{ padding: '10px', borderBottom: '1px solid #4b5563', textAlign: 'left', color: '#e5e7eb' }}>Giá trị</th>
                                            <th style={{ padding: '10px', borderBottom: '1px solid #4b5563', textAlign: 'left', color: '#e5e7eb' }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {specs.map((spec, index) => {
                                            const specKey = spec.key || '';
                                            const specValue = spec.value || '';
                                            
                                            return (
                                                <tr key={index}>
                                                    <td style={{ padding: '10px', borderBottom: '1px solid #374151', color: '#e5e7eb' }}>
                                                        {index + 1}
                                                    </td>
                                                    <td style={{ padding: '10px', borderBottom: '1px solid #374151', color: '#e5e7eb' }}>
                                                        <input
                                                            type="text"
                                                            value={specKey}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                if (!value.trim() && value !== '') {
                                                                    alert('Tên thông số không được chỉ chứa khoảng trắng');
                                                                    return;
                                                                }
                                                                handleSpecChange(index, 'key', value);
                                                            }}
                                                            style={{
                                                                width: '100%',
                                                                padding: '6px',
                                                                border: specKey.trim() === '' ? '1px solid #ef4444' : '1px solid #4b5563',
                                                                borderRadius: '4px',
                                                                background: '#1f2937',
                                                                color: '#e5e7eb'
                                                            }}
                                                            placeholder="Nhập tên thông số *"
                                                        />
                                                        {specKey.trim() === '' && (
                                                            <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                                                                Tên thông số là bắt buộc
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '10px', borderBottom: '1px solid #374151', color: '#e5e7eb' }}>
                                                        <input
                                                            type="text"
                                                            value={specValue}
                                                            onChange={(e) => handleSpecChange(index, 'value', e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '6px',
                                                                border: '1px solid #4b5563',
                                                                borderRadius: '4px',
                                                                background: '#1f2937',
                                                                color: '#e5e7eb'
                                                            }}
                                                            placeholder="Nhập giá trị"
                                                        />
                                                    </td>
                                                    <td style={{ padding: '10px', borderBottom: '1px solid #374151', color: '#e5e7eb' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSpec(index)}
                                                            className="btn-spec-remove"
                                                        >
                                                            Xóa
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="modal-footer">
                    <button onClick={handleSave} className="btn-spec-save">
                        Lưu thông số
                    </button>
                    <button onClick={onClose} className="btn-spec-cancel">
                        Hủy
                    </button>
                </div>
            </div>
            
            <style jsx>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                
                .modal-content {
                    background: #1f2937;
                    border-radius: 8px;
                    width: 800px;
                    max-width: 90%;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    border: 1px solid #374151;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
                }
                
                .modal-header {
                    padding: 20px;
                    border-bottom: 1px solid #374151;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .modal-close {
                    background: none;
                    border: none;
                    color: #9ca3af;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                }
                
                .modal-close:hover {
                    background: #374151;
                    color: #e5e7eb;
                }
                
                .modal-body {
                    padding: 20px;
                    flex: 1;
                    overflow-y: auto;
                }
                
                .add-spec-section {
                    margin-bottom: 25px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid #374151;
                }
                
                .specs-list-section {
                    margin-bottom: 20px;
                }
                
                .specs-table {
                    overflow-x: auto;
                }
                
                .modal-footer {
                    padding: 20px;
                    border-top: 1px solid #374151;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
                
                .btn-spec-add {
                    background: #3b82f6;
                    color: white;
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .btn-spec-add:hover:not(:disabled) {
                    background: #2563eb;
                    transform: translateY(-1px);
                }
                
                .btn-spec-add:disabled {
                    background: #4b5563;
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                
                .btn-spec-remove {
                    background: #ef4444;
                    color: white;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .btn-spec-remove:hover {
                    background: #dc2626;
                    transform: translateY(-1px);
                }
                
                .btn-spec-save {
                    background: #10b981;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .btn-spec-save:hover {
                    background: #059669;
                    transform: translateY(-1px);
                }
                
                .btn-spec-cancel {
                    background: #6b7280;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .btn-spec-cancel:hover {
                    background: #4b5563;
                    transform: translateY(-1px);
                }
            `}</style>
        </div>
    );
};

const Products = () => {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentId, setCurrentId] = useState(null);
    const [showSpecsModal, setShowSpecsModal] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState(null);
    const [selectedProductName, setSelectedProductName] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState(null);
    
    // State cho bộ lọc
    const [filters, setFilters] = useState({
        searchTerm: '',
        categoryId: '',
        priceRange: {
            min: '',
            max: ''
        },
        status: ''
    });

    const [product, setProduct] = useState({
        Product_name: '',
        Price: '',
        Product_status: 'Draft',
        picUrl: '',
        CategoryId: '',
        Description: '',
        model: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    // Áp dụng bộ lọc khi filters thay đổi
    useEffect(() => {
        applyFilters();
    }, [filters, products]);

    const fetchData = async () => {
        try {
            console.log('Fetching products and categories...');
            const [productsRes, categoriesRes] = await Promise.all([
                api.get('/products'),
                api.get('/categories')
            ]);
            
            console.log('Raw products data:', productsRes.data);
            console.log('Categories data:', categoriesRes.data);
            
            // Đảm bảo dữ liệu không bị null/undefined
            const processedProducts = productsRes.data.map(item => ({
                ...item,
                Product_name: item.Product_name || 'Không có tên',
                Product_status: item.Product_status || 'Draft',
                Category_name: item.Category_name || 'Chưa phân loại',
                picUrl: item.picUrl || '',
                Price: parseFloat(item.Price || 0)
            }));
            
            console.log('Processed products:', processedProducts);
            
            setProducts(processedProducts);
            setFilteredProducts(processedProducts); // Khởi tạo filteredProducts
            setCategories(categoriesRes.data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching data:', err);
            console.error('Error response:', err.response?.data);
            setError(err.message);
            setLoading(false);
        }
    };

    // Hàm áp dụng bộ lọc
    const applyFilters = () => {
        let result = [...products];
        
        // Lọc theo từ khóa tìm kiếm
        if (filters.searchTerm) {
            const searchTerm = filters.searchTerm.toLowerCase();
            result = result.filter(product => 
                product.Product_name.toLowerCase().includes(searchTerm) ||
                (product.model && product.model.toLowerCase().includes(searchTerm)) ||
                (product.Description && product.Description.toLowerCase().includes(searchTerm))
            );
        }
        
        // Lọc theo danh mục
        if (filters.categoryId) {
            result = result.filter(product => 
                product.CategoryId == filters.categoryId
            );
        }
        
        // Lọc theo giá
        if (filters.priceRange.min !== '') {
            const minPrice = parseFloat(filters.priceRange.min);
            result = result.filter(product => 
                product.Price >= minPrice
            );
        }
        
        if (filters.priceRange.max !== '') {
            const maxPrice = parseFloat(filters.priceRange.max);
            result = result.filter(product => 
                product.Price <= maxPrice
            );
        }
        
        // Lọc theo trạng thái
        if (filters.status) {
            result = result.filter(product => 
                product.Product_status === filters.status
            );
        }
        
        setFilteredProducts(result);
    };

    // Xử lý thay đổi bộ lọc
    const handleFilterChange = (field, value) => {
        setFilters(prev => {
            if (field.includes('.')) {
                const [parent, child] = field.split('.');
                return {
                    ...prev,
                    [parent]: {
                        ...prev[parent],
                        [child]: value
                    }
                };
            }
            return {
                ...prev,
                [field]: value
            };
        });
    };

    // Reset bộ lọc
    const resetFilters = () => {
        setFilters({
            searchTerm: '',
            categoryId: '',
            priceRange: {
                min: '',
                max: ''
            },
            status: ''
        });
    };

    const handleAdd = () => {
        setProduct({
            Product_name: '',
            Price: '',
            Product_status: 'Draft',
            picUrl: '',
            CategoryId: '',
            Description: '',
            model: ''
        });
        setEditMode(false);
        setShowForm(true);
    };

    const handleEdit = (item) => {
        console.log('Editing product:', item);
        setProduct({
            Product_name: item.Product_name || '',
            Price: item.Price || '',
            Product_status: item.Product_status || 'Draft',
            picUrl: item.picUrl || '',
            CategoryId: item.CategoryId || '',
            Description: item.Description || '',
            model: item.model || ''
        });
        setCurrentId(item.Id);
        setEditMode(true);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
            try {
                await api.delete(`/products/${id}`);
                alert('Xóa thành công!');
                fetchData();
            } catch (err) {
                alert('Lỗi khi xóa: ' + (err.response?.data?.error || err.message));
            }
        }
    };

    const handleOpenSpecs = (productItem) => {
        if (!productItem.Id) {
            alert('Sản phẩm chưa được lưu. Vui lòng lưu sản phẩm trước khi thêm thông số.');
            return;
        }
        setSelectedProductId(productItem.Id);
        setSelectedProductName(productItem.Product_name || '');
        setSelectedCategoryId(productItem.CategoryId || '');
        setShowSpecsModal(true);
    };

    const handleOpenSpecsFromForm = () => {
        if (!currentId && !editMode) {
            alert('Vui lòng lưu sản phẩm trước khi thêm thông số.');
            return;
        }
        setSelectedProductId(currentId);
        setSelectedProductName(product.Product_name || '');
        setSelectedCategoryId(product.CategoryId || '');
        setShowSpecsModal(true);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProduct({ ...product, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!product.Product_name || !product.Price || !product.CategoryId) {
            alert('Vui lòng nhập đầy đủ thông tin bắt buộc.');
            return;
        }

        try {
            if (editMode) {
                await api.put(`/products/${currentId}`, product);
                alert('Cập nhật sản phẩm thành công!');
            } else {
                const result = await api.post('/products', product);
                setCurrentId(result.data.id); 
                alert('Thêm sản phẩm thành công!');
            }
            setShowForm(false);
            fetchData();
        } catch (err) {
            alert('Lỗi khi lưu: ' + (err.response?.data?.error || err.message));
        }
    };

    const renderHead = (item, index) => <th key={index}>{item}</th>;
    
    const renderBody = (item, index) => {
        console.log('Rendering product item:', item);
        
        // Đảm bảo không bị lỗi với giá trị null/undefined
        const productName = item.Product_name || 'Không có tên';
        const productStatus = item.Product_status || 'Draft';
        const categoryName = item.Category_name || 'Chưa phân loại';
        const price = parseFloat(item.Price || 0);
        const imageUrl = item.picUrl;

        return (
            <tr key={index}>
                <td>{index + 1}</td>
                <td>{item.Id}</td>
                <td>{productName}</td>
                <td>{price.toLocaleString('vi-VN')} VND</td>
                <td>
                    <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: 
                            productStatus === 'Published' ? '#10b981' :
                            productStatus === 'Draft' ? '#f59e0b' :
                            productStatus === 'OutOfStock' ? '#ef4444' :
                            productStatus === 'Archived' ? '#6b7280' : '#3b82f6',
                        color: 'white'
                    }}>
                        {productStatus}
                    </span>
                </td>
                <td>
                    <ImageWithFallback 
                        src={imageUrl}
                        alt={productName}
                        style={{ 
                            width: 50, 
                            height: 50, 
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #374151'
                        }}
                    />
                </td>
                <td>{categoryName}</td>
                <td>
                    <button className="btn-edit" onClick={() => handleEdit(item)}>Sửa</button>
                    <button className="btn-specs" onClick={() => handleOpenSpecs(item)}>Thông số</button>
                    <button className="btn-delete" onClick={() => handleDelete(item.Id)}>Xóa</button>
                </td>
            </tr>
        );
    };

    if (loading) return <div style={{ color: '#e5e7eb', padding: '20px' }}>Loading...</div>;
    if (error) return <div style={{ color: '#ef4444', padding: '20px' }}>Error: {error}</div>;

    return (
        <div style={{ backgroundColor: '#111827', minHeight: '100vh', color: '#e5e7eb', padding: '20px' }}>
            <div className="page-header">
                <h2 style={{ color: '#f9fafb', margin: 0 }}>Sản phẩm</h2>
                <button className="btn btn-add" onClick={handleAdd}>+ Thêm sản phẩm</button>
            </div>

            {/* Bộ lọc sản phẩm */}
            <div className="filter-section">
                <h3 style={{ color: '#f9fafb', marginBottom: '15px' }}>Bộ lọc sản phẩm</h3>
                <div className="filter-grid">
                    {/* Tìm kiếm theo tên */}
                    <div className="filter-group">
                        <label style={{ display: 'block', marginBottom: '5px', color: '#e5e7eb' }}>
                            Tìm kiếm sản phẩm:
                        </label>
                        <input
                            type="text"
                            placeholder="Nhập tên sản phẩm, model hoặc mô tả..."
                            value={filters.searchTerm}
                            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                            className="filter-input"
                        />
                    </div>

                    {/* Lọc theo danh mục */}
                    <div className="filter-group">
                        <label style={{ display: 'block', marginBottom: '5px', color: '#e5e7eb' }}>
                            Danh mục:
                        </label>
                        <select
                            value={filters.categoryId}
                            onChange={(e) => handleFilterChange('categoryId', e.target.value)}
                            className="filter-select"
                        >
                            <option value="">Tất cả danh mục</option>
                            {categories.map(cat => (
                                <option key={cat.Id} value={cat.Id}>{cat.Category_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Lọc theo trạng thái */}
                    <div className="filter-group">
                        <label style={{ display: 'block', marginBottom: '5px', color: '#e5e7eb' }}>
                            Trạng thái:
                        </label>
                        <select
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="filter-select"
                        >
                            <option value="">Tất cả trạng thái</option>
                            <option value="Draft">Bản nháp</option>
                            <option value="Published">Đã xuất bản</option>
                            <option value="OutOfStock">Hết hàng</option>
                            <option value="Archived">Đã lưu trữ</option>
                        </select>
                    </div>

                    {/* Lọc theo giá */}
                    <div className="filter-group">
                        <label style={{ display: 'block', marginBottom: '5px', color: '#e5e7eb' }}>
                            Khoảng giá:
                        </label>
                        <div className="price-range">
                            <input
                                type="number"
                                placeholder="Giá thấp nhất"
                                value={filters.priceRange.min}
                                onChange={(e) => handleFilterChange('priceRange.min', e.target.value)}
                                className="price-input"
                                min="0"
                            />
                            <span style={{ color: '#9ca3af', margin: '0 8px' }}>-</span>
                            <input
                                type="number"
                                placeholder="Giá cao nhất"
                                value={filters.priceRange.max}
                                onChange={(e) => handleFilterChange('priceRange.max', e.target.value)}
                                className="price-input"
                                min="0"
                            />
                        </div>
                    </div>

                    {/* Nút reset filter */}
                    <div className="filter-group" style={{ alignSelf: 'flex-end' }}>
                        <button
                            onClick={resetFilters}
                            className="btn-reset"
                            disabled={!filters.searchTerm && !filters.categoryId && !filters.status && !filters.priceRange.min && !filters.priceRange.max}
                        >
                            Xóa bộ lọc
                        </button>
                    </div>
                </div>
                
                {/* Thông tin kết quả lọc */}
                <div style={{ marginTop: '10px', color: '#9ca3af', fontSize: '14px' }}>
                    Đang hiển thị {filteredProducts.length} / {products.length} sản phẩm
                </div>
            </div>

            {showForm && (
                <div className="add-form">
                    <h3 style={{ color: '#f9fafb', marginTop: 0 }}>{editMode ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                    <form onSubmit={handleSubmit}>
                        <label>Tên sản phẩm:</label>
                        <input 
                            type="text" 
                            name="Product_name" 
                            value={product.Product_name} 
                            onChange={handleChange} 
                            required 
                            placeholder="Nhập tên sản phẩm"
                        />

                        <label>Giá:</label>
                        <input 
                            type="number" 
                            name="Price" 
                            value={product.Price} 
                            onChange={handleChange} 
                            required 
                            min="0" 
                            step="0.01" 
                            placeholder="Nhập giá sản phẩm"
                        />

                        <label>Trạng thái:</label>
                        <select name="Product_status" value={product.Product_status} onChange={handleChange}>
                            <option value="Draft">Bản nháp</option>
                            <option value="Published">Đã xuất bản</option>
                            <option value="OutOfStock">Hết hàng</option>
                            <option value="Archived">Đã lưu trữ</option>
                        </select>

                        <label>Danh mục:</label>
                        <select name="CategoryId" value={product.CategoryId} onChange={handleChange} required>
                            <option value="">-- Chọn danh mục --</option>
                            {categories.map(cat => (
                                <option key={cat.Id} value={cat.Id}>{cat.Category_name}</option>
                            ))}
                        </select>

                        <label>URL hình ảnh:</label>
                        <input 
                            type="text" 
                            name="picUrl" 
                            value={product.picUrl} 
                            onChange={handleChange} 
                            placeholder="https://example.com/image.jpg"
                        />

                        <label>Mô tả:</label>
                        <textarea 
                            name="Description" 
                            value={product.Description} 
                            onChange={handleChange} 
                            rows="3" 
                            placeholder="Nhập mô tả sản phẩm"
                        />

                        <label>Model:</label>
                        <input 
                            type="text" 
                            name="model" 
                            value={product.model} 
                            onChange={handleChange} 
                            placeholder="Nhập model sản phẩm"
                        />

                        {product.picUrl && (
                            <div>
                                <label>Preview:</label>
                                <ImageWithFallback 
                                    src={product.picUrl}
                                    alt="preview"
                                    style={{ 
                                        width: 100, 
                                        marginTop: 10,
                                        borderRadius: '4px',
                                        border: '1px solid #374151'
                                    }}
                                />
                            </div>
                        )}

                        <div className="form-actions">
                            <button type="submit" className="btn-submit">Lưu</button>
                            <button 
                                type="button" 
                                onClick={handleOpenSpecsFromForm}
                                className="btn-specs"
                                disabled={!editMode}
                            >
                                Quản lý thông số
                            </button>
                            <button type="button" onClick={() => setShowForm(false)} className="btn-cancel">Hủy</button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                <div className="card__body">
                    <Table
                        limit="10"
                        headData={productTableHead}
                        renderHead={renderHead}
                        bodyData={filteredProducts}
                        renderBody={renderBody}
                    />
                </div>
            </div>

            {showSpecsModal && (
                <SpecsModal
                    productId={selectedProductId}
                    productName={selectedProductName}
                    categoryId={selectedCategoryId}
                    onClose={() => setShowSpecsModal(false)}
                    onSave={fetchData}
                />
            )}

            <style jsx>{`
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .filter-section {
                    background: #1f2937;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border: 1px solid #374151;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
                }
                
                .filter-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                }
                
                .filter-group {
                    display: flex;
                    flex-direction: column;
                }
                
                .filter-input,
                .filter-select,
                .price-input {
                    padding: 10px;
                    border: 1px solid #4b5563;
                    border-radius: 6px;
                    background: #374151;
                    color: #e5e7eb;
                    font-size: 14px;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .filter-input::placeholder,
                .price-input::placeholder {
                    color: #9ca3af;
                    font-size: 12px;
                }
                
                .filter-input:focus,
                .filter-select:focus,
                .price-input:focus {
                    border-color: #3b82f6;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                
                .price-range {
                    display: flex;
                    align-items: center;
                }
                
                .price-input {
                    flex: 1;
                }
                
                .btn-reset {
                    background: #6b7280;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                    width: 100%;
                }
                
                .btn-reset:hover:not(:disabled) {
                    background: #4b5563;
                    transform: translateY(-1px);
                }
                
                .btn-reset:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .btn-add {
                    background: #10b981;
                    color: white;
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .btn-add:hover {
                    background: #059669;
                    transform: translateY(-1px);
                }
                
                .add-form {
                    background: #1f2937;
                    padding: 24px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    border: 1px solid #374151;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
                }
                
                .add-form h3 {
                    margin-top: 0;
                    color: #f9fafb;
                    border-bottom: 1px solid #374151;
                    padding-bottom: 10px;
                }
                
                .add-form label {
                    display: block;
                    margin: 12px 0 6px;
                    font-weight: 500;
                    color: #e5e7eb;
                }
                
                .add-form input,
                .add-form select,
                .add-form textarea {
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #4b5563;
                    border-radius: 6px;
                    margin-bottom: 12px;
                    font-size: 14px;
                    box-sizing: border-box;
                    background: #374151;
                    color: #e5e7eb;
                    transition: all 0.2s;
                }
                
                .add-form input::placeholder,
                .add-form textarea::placeholder {
                    color: #9ca3af;
                }
                
                .add-form input:focus,
                .add-form select:focus,
                .add-form textarea:focus {
                    border-color: #10b981;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
                }
                
                .form-actions {
                    margin-top: 24px;
                    display: flex;
                    gap: 12px;
                }
                
                .btn-submit {
                    background: #10b981;
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .btn-submit:hover {
                    background: #059669;
                    transform: translateY(-1px);
                }
                
                .btn-specs {
                    background: #8b5cf6;
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .btn-specs:hover:not(:disabled) {
                    background: #7c3aed;
                    transform: translateY(-1px);
                }
                
                .btn-specs:disabled {
                    background: #4b5563;
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                
                .btn-cancel {
                    background: #6b7280;
                    color: white;
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .btn-cancel:hover {
                    background: #4b5563;
                    transform: translateY(-1px);
                }
                
                .btn-edit {
                    background: #3b82f6;
                    color: white;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 8px;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .btn-edit:hover { 
                    background: #2563eb;
                    transform: translateY(-1px);
                }
                
                .btn-delete {
                    background: #ef4444;
                    color: white;
                    padding: 6px 12px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s;
                    margin-left: 8px;
                }
                
                .btn-delete:hover { 
                    background: #dc2626;
                    transform: translateY(-1px);
                }
                
                .card {
                    background: #1f2937;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
                    border: 1px solid #374151;
                    overflow: hidden;
                }
                
                .card__body {
                    padding: 0;
                }

                /* Style cho table */
                :global(table) {
                    width: 100%;
                    border-collapse: collapse;
                    background: #1f2937;
                }

                :global(th) {
                    background: #374151;
                    color: #f9fafb;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    border-bottom: 1px solid #4b5563;
                }

                :global(td) {
                    padding: 12px;
                    border-bottom: 1px solid #374151;
                    color: #e5e7eb;
                }

                :global(tr:hover) {
                    background: #374151;
                }

                :global(tr:nth-child(even)) {
                    background: #1f2937;
                }

                :global(tr:nth-child(even):hover) {
                    background: #374151;
                }
            `}</style>
        </div>
    );
};

export default Products;