//
//  Bonsai_ChefApp.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 08.01.2024.
//

import SwiftUI

@main
struct YourApp: App {
    @StateObject private var bonsaiData = BonsaiData()
    @StateObject private var toolsSupplementsData = ToolsSupplementsData()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(bonsaiData)
                .environmentObject(toolsSupplementsData)
                .onAppear {
                    bonsaiData.loadRecords()
                    toolsSupplementsData.loadRecords()
                }
        }
    }
}
