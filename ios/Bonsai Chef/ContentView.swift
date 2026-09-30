//
//  ContentView.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 08.01.2024.
//

import SwiftUI

struct ContentView: View {
    @StateObject var bonsaiData = BonsaiData()
    @StateObject var toolsSupplementsData = ToolsSupplementsData()
    @State private var isAddRecordViewPresented = false
    @State private var isToolAddRecordViewPresented = false
    @State private var selectedCategory: Category = .all

    var body: some View {
        NavigationView {
            TabView(selection: $selectedCategory) {
                CategoryView(category: .all, bonsaiData: bonsaiData, toolCategory: .all, toolsSupplementsData: toolsSupplementsData) {
                    print("Edit button tapped for record in All category")
                }
                .tabItem {
                    Label("History", systemImage: "tree.fill")
                }
                .tag(Category.all)

                CategoryView(category: .category1, bonsaiData: bonsaiData, toolCategory: .category1, toolsSupplementsData: toolsSupplementsData) {
                    print("Edit button tapped for record in Category 1")
                }
                .tabItem {
                    Label("Outdoor", systemImage: "sun.max")
                }
                .tag(Category.category1)
                
                CategoryView(category: .category2, bonsaiData: bonsaiData, toolCategory: .category2, toolsSupplementsData: toolsSupplementsData) {
                    print("Edit button tapped for record in Category 2")
                }
                .tabItem {
                    Label("Indoor", systemImage: "house")
                }
                .tag(Category.category2)
                
                CategoryView(category: .category3, bonsaiData: bonsaiData, toolCategory: .category3, toolsSupplementsData: toolsSupplementsData) {
                    print("Edit button tapped for record in Category 3")
                }
                .tabItem {
                    Label("Tools", systemImage: "leaf")
                }
                .tag(Category.category3)
            }
            .navigationBarTitle(selectedCategory.title)
            .navigationBarItems(
                leading: Button(action: {
                    isAddRecordViewPresented = true
                }) {
                    Image(systemName: "apple.meditate.square.stack.fill")
                    //Text("Add Bonsai Record")
                },
                trailing: Button(action: {
                    isToolAddRecordViewPresented = true
                }) {
                    Image(systemName: "hammer")
                    //Text("Add Tool Record")
                }
            )
            .sheet(isPresented: $isAddRecordViewPresented) {
                AddRecordView(bonsaiData: bonsaiData) {
                    isAddRecordViewPresented = false
                }
            }
            .sheet(isPresented: $isToolAddRecordViewPresented) {
                ToolAddRecordView(toolsSupplementsData: toolsSupplementsData)
                    .environmentObject(toolsSupplementsData)
            }
        }
        .environmentObject(bonsaiData)
        .environmentObject(toolsSupplementsData)
    }
}



