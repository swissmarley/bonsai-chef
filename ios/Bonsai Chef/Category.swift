//
//  Category.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 11.01.2024.
//

import Foundation

enum Category: String, CaseIterable {
    case all = "History"
    case category1 = "Bonsai Esterno"
    case category2 = "Bonsai Interno"
    case category3 = "Strumenti & Altro"
    case category4 = "Category 4"

    var title: String {
        return rawValue
    }
}

enum BonsaiCategory: String, CaseIterable, Codable {
    case all = "History"
    case category1 = "Bonsai Esterno"
    case category2 = "Bonsai Interno"
    case category3 = "Strumenti & Altro"
    case category4 = "Category 4"
    
    var title: String {
        return rawValue
    }
}

enum ToolCategory: String, CaseIterable, Codable {
    case all = "History"
    case category1 = "Bonsai Esterno"
    case category2 = "Bonsai Interno"
    case category3 = "Strumenti & Altro"
}
